package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/leadtime"
	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
	"github.com/JamesHawking/print-cut-ship/backend/internal/orders"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// adminLimitBounds clamps the board pagination (one-operator tool; offset
// paging, no cursors). limit is cast to int32 for the sqlc params only after
// clamping.
const (
	adminDefaultLimit = 50
	adminMaxLimit     = 200
)

// now is the clock seam for ship-by/ops derivations (plan 07): Config.Now in
// tests, time.Now otherwise.
func (s *server) now() time.Time {
	if s.cfg.Now != nil {
		return s.cfg.Now()
	}
	return time.Now()
}

// shipBy derives an order's ship-by date from the lead-time engine: paid_at
// is the anchor, the business-days budget is the max over the items' lead
// times resolved through the active pricing config (documented simplification
// — items keep their lead-time id, not a copy of the config entry). Nil until
// the order is paid (and for cancelled/refunded).
func (s *server) shipBy(status string, leadTimeIDs []string, paidAt pgtype.Timestamptz) *leadtime.CalDate {
	switch OrderStatus(status) {
	case Paid, InProduction, Shipped, Delivered:
	default:
		return nil
	}
	if !paidAt.Valid {
		return nil
	}
	cfg := s.activePricing().Cfg
	days := 0
	for _, id := range leadTimeIDs {
		if lt, ok := cfg.LeadTime(id); ok && lt.BusinessDays > days {
			days = lt.BusinessDays
		}
	}
	sd := leadtime.ComputeShipDate(days, cfg.SameDayCutoffHour, paidAt.Time)
	return &sd.Date
}

func (s *server) adminOrderSummary(row store.AdminListOrdersRow) AdminOrderSummary {
	sum := AdminOrderSummary{
		OrderId:       row.ShortID,
		Email:         row.Email,
		Status:        OrderStatus(row.Status),
		GrossTotalPln: money.FromGrosze(row.GrossTotalGrosze),
		CreatedAt:     row.CreatedAt.Time,
		PartCount:     int(row.PartCount),
		DfmFlagged:    len(row.DfmCodes) > 0,
	}
	if len(row.DfmCodes) > 0 {
		sum.DfmCodes = &row.DfmCodes
	}
	if row.PaidAt.Valid {
		t := row.PaidAt.Time
		sum.PaidAt = &t
	}
	sum.TrackingNumber = row.TrackingNumber
	if ship := s.shipBy(row.Status, row.LeadTimes, row.PaidAt); ship != nil {
		iso := ship.ISO()
		sum.ShipBy = &iso
		if ship.Before(leadtime.Today(s.now())) {
			overdue := true
			sum.Overdue = &overdue
		}
	}
	return sum
}

// AdminListOrders is the orders board list. Guarded by adminPrefixGuard.
func (s *server) AdminListOrders(w http.ResponseWriter, r *http.Request, params AdminListOrdersParams) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	limit := adminDefaultLimit
	if params.Limit != nil {
		limit = *params.Limit
	}
	if limit < 1 {
		limit = 1
	}
	if limit > adminMaxLimit {
		limit = adminMaxLimit
	}
	offset := 0
	if params.Offset != nil && *params.Offset > 0 {
		offset = *params.Offset
	}
	var status *string
	if params.Status != nil {
		st := string(*params.Status)
		status = &st
	}

	ctx := r.Context()
	rows, err := s.cfg.Store.AdminListOrders(ctx, store.AdminListOrdersParams{
		Status:    status,
		RowLimit:  int32(limit),
		RowOffset: int32(offset),
	})
	if err != nil {
		s.cfg.Logger.Error("admin list orders failed", "err", err)
		internalError(w, "failed to list orders")
		return
	}
	total, err := s.cfg.Store.AdminCountOrders(ctx, status)
	if err != nil {
		s.cfg.Logger.Error("admin count orders failed", "err", err)
		internalError(w, "failed to count orders")
		return
	}

	orders := make([]AdminOrderSummary, 0, len(rows))
	for _, row := range rows {
		orders = append(orders, s.adminOrderSummary(row))
	}
	writeJSON(w, http.StatusOK, AdminListOrdersResponse{
		Orders: orders,
		Total:  int(total),
		Limit:  limit,
		Offset: offset,
	})
}

// AdminGetOrder is the operator's full order view: the order record (incl.
// the status capability token for support), line items with their frozen
// pricing snapshots, and the payment/invoice ledgers. Guarded by
// adminPrefixGuard.
func (s *server) AdminGetOrder(w http.ResponseWriter, r *http.Request, orderId string) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	ctx := r.Context()
	o, err := s.cfg.Store.GetOrderByShortID(ctx, orderId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, OrderNotFound, "order not found", nil)
			return
		}
		s.cfg.Logger.Error("admin get order failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load order")
		return
	}
	detail, err := s.buildOrderDetail(ctx, o)
	if err != nil {
		s.cfg.Logger.Error("admin get order: build failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load order detail")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

// buildOrderDetail assembles the admin detail view for one loaded order row:
// items with frozen snapshots plus the payment/invoice ledgers. Shared by
// AdminGetOrder and the GDPR export.
func (s *server) buildOrderDetail(ctx context.Context, o store.Order) (AdminOrderDetail, error) {
	items, err := s.cfg.Store.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil {
		return AdminOrderDetail{}, fmt.Errorf("items: %w", err)
	}
	payments, err := s.cfg.Store.ListPaymentsByOrderID(ctx, o.ID)
	if err != nil {
		return AdminOrderDetail{}, fmt.Errorf("payments: %w", err)
	}
	invoices, err := s.cfg.Store.ListInvoicesByOrderID(ctx, o.ID)
	if err != nil {
		return AdminOrderDetail{}, fmt.Errorf("invoices: %w", err)
	}

	var totals OrderTotals
	if err := json.Unmarshal(o.PricingSnapshot, &totals); err != nil {
		return AdminOrderDetail{}, fmt.Errorf("snapshot decode: %w", err)
	}
	var shipping Address
	if err := json.Unmarshal(o.ShippingAddress, &shipping); err != nil {
		return AdminOrderDetail{}, fmt.Errorf("address decode: %w", err)
	}
	order := AdminOrder{
		OrderId:          o.ShortID,
		Email:            o.Email,
		Status:           OrderStatus(o.Status),
		Locale:           o.Locale,
		Country:          o.Country,
		CompanyName:      o.CompanyName,
		Nip:              o.Nip,
		InvoiceRequested: o.InvoiceRequested,
		CreatedAt:        o.CreatedAt.Time,
		ShippingAddress:  shipping,
		StatusToken:      o.StatusToken,
		TrackingNumber:   o.TrackingNumber,
		Totals:           totals,
		GrossTotalPln:    money.FromGrosze(o.GrossTotalGrosze),
		VatPln:           money.FromGrosze(o.VatGrosze),
		PricingConfigId:  o.PricingConfigID,
	}
	if o.PaidAt.Valid {
		t := o.PaidAt.Time
		order.PaidAt = &t
	}
	if len(o.BillingAddress) > 0 {
		var billing Address
		if err := json.Unmarshal(o.BillingAddress, &billing); err != nil {
			return AdminOrderDetail{}, fmt.Errorf("billing decode: %w", err)
		}
		order.BillingAddress = &billing
	}

	viewItems := make([]AdminOrderItem, 0, len(items))
	for _, it := range items {
		item := AdminOrderItem{
			FileId:       it.FileID,
			FileName:     it.FileName,
			Process:      ProcessId(it.Process),
			Quantity:     int(it.Quantity),
			LeadTime:     LeadTimeId(it.LeadTime),
			UnitPricePln: money.FromGrosze(it.UnitPriceGrosze),
			LineTotalPln: money.FromGrosze(it.LineTotalGrosze),
		}
		var snap map[string]any
		if err := json.Unmarshal(it.PartQuoteSnapshot, &snap); err == nil {
			item.PartQuoteSnapshot = &snap
		}
		viewItems = append(viewItems, item)
	}
	viewPayments := make([]AdminPayment, 0, len(payments))
	for _, p := range payments {
		viewPayments = append(viewPayments, AdminPayment{
			Provider:        p.Provider,
			ProviderEventId: p.ProviderEventID,
			PaymentRef:      p.PaymentRef,
			Type:            AdminPaymentType(p.Type),
			AmountPln:       money.FromGrosze(p.AmountGrosze),
			Status:          p.Status,
			CreatedAt:       p.CreatedAt.Time,
		})
	}
	viewInvoices := make([]AdminInvoice, 0, len(invoices))
	for _, inv := range invoices {
		out := AdminInvoice{
			ProviderId: inv.ProviderID,
			Number:     inv.Number,
			PdfUrl:     inv.PdfUrl,
			Kind:       AdminInvoiceKind(inv.Kind),
			CreatedAt:  inv.CreatedAt.Time,
		}
		if inv.IssuedAt.Valid {
			t := inv.IssuedAt.Time
			out.IssuedAt = &t
		}
		if inv.RetentionUntil.Valid {
			iso := inv.RetentionUntil.Time.Format("2006-01-02")
			out.RetentionUntil = &iso
		}
		viewInvoices = append(viewInvoices, out)
	}

	return AdminOrderDetail{
		Order:    order,
		Items:    viewItems,
		Payments: viewPayments,
		Invoices: viewInvoices,
	}, nil
}

// AdminTransitionOrder moves an order along the lifecycle. Only board
// transitions are accepted: paid/refunded flip exclusively through
// payments.Pipeline (the money invariant), so those targets are 400s here.
// The state machine asserts the edge and the SQL-guarded Mark* is the
// race-proof second gate. Guarded by adminPrefixGuard.
func (s *server) AdminTransitionOrder(w http.ResponseWriter, r *http.Request, orderId string) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	var req TransitionOrderRequest
	if !decodeBody(w, r, &req) {
		return
	}
	to := orders.Status(req.To)
	switch to {
	case orders.StatusInProduction, orders.StatusShipped, orders.StatusDelivered, orders.StatusCancelled:
	default:
		badRequest(w, TransitionNotAllowed,
			fmt.Sprintf("status %q is not a board transition target", req.To),
			map[string]any{"to": string(req.To)})
		return
	}
	if to == orders.StatusShipped && (req.TrackingNumber == nil || *req.TrackingNumber == "") {
		badRequest(w, TrackingRequired, "shipped requires a tracking number", nil)
		return
	}

	ctx := r.Context()
	o, err := s.cfg.Store.GetOrderByShortID(ctx, orderId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, OrderNotFound, "order not found", nil)
			return
		}
		s.cfg.Logger.Error("transition: load order failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load order")
		return
	}
	if err := orders.AssertTransition(orders.Status(o.Status), to); err != nil {
		apiError(w, http.StatusConflict, OrderWrongState, err.Error(),
			map[string]any{"from": o.Status, "to": string(to)})
		return
	}

	var marked int64
	switch to {
	case orders.StatusInProduction:
		marked, err = s.cfg.Store.MarkOrderInProduction(ctx, o.ID)
	case orders.StatusShipped:
		marked, err = s.cfg.Store.MarkOrderShipped(ctx, store.MarkOrderShippedParams{
			ID: o.ID, TrackingNumber: req.TrackingNumber,
		})
	case orders.StatusDelivered:
		marked, err = s.cfg.Store.MarkOrderDelivered(ctx, o.ID)
	case orders.StatusCancelled:
		marked, err = s.cfg.Store.MarkOrderCancelled(ctx, o.ID)
	}
	if err != nil {
		s.cfg.Logger.Error("transition: mark failed", "orderId", orderId, "to", to, "err", err)
		internalError(w, "failed to transition order")
		return
	}
	if marked == 0 {
		// Lost a race with another transition between load and mark.
		apiError(w, http.StatusConflict, OrderWrongState,
			fmt.Sprintf("order no longer in %s", o.Status),
			map[string]any{"from": o.Status, "to": string(to)})
		return
	}

	// Notify seam (plan 06): one structured line per applied transition, then
	// the status email — Shipped (with tracking) for shipped, StatusChange
	// for in_production/delivered/cancelled. Deduped per (to, order).
	attrs := []any{"orderId", o.ShortID, "from", o.Status, "to", string(to)}
	if to == orders.StatusShipped && req.TrackingNumber != nil {
		attrs = append(attrs, "trackingNumber", *req.TrackingNumber)
	}
	s.cfg.Logger.Info("notify seam: order status email (plan 06 hook)", attrs...)
	if s.cfg.Email != nil && s.cfg.Store != nil {
		data, derr := s.orderEmailData(ctx, o)
		if derr != nil {
			s.cfg.Logger.Error("status email: load items failed", "orderId", o.ShortID, "err", derr)
		} else {
			in := email.Input{
				To: o.Email, Locale: o.Locale, OrderID: &o.ID, UserID: o.UserID,
				DedupeKey: "status_" + string(to) + ":" + o.ShortID,
			}
			if to == orders.StatusShipped {
				in.Template = email.Shipped
				tracking := ""
				if req.TrackingNumber != nil {
					tracking = *req.TrackingNumber
				}
				in.Data = email.ShippedData{
					OrderShortID:   data.OrderShortID,
					TrackingNumber: tracking,
					StatusURL:      data.StatusURL,
				}
			} else {
				in.Template = email.StatusChange
				in.Data = email.StatusChangeData{
					OrderShortID: data.OrderShortID,
					NewStatus:    string(to),
					StatusURL:    data.StatusURL,
				}
			}
			s.sendMail(ctx, in)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// AdminDownloadOrderFile streams a stored model file attached to the order.
// Guarded by adminPrefixGuard; the query itself enforces that the file
// belongs to THIS order (a foreign file id is a 404, never a leak).
func (s *server) AdminDownloadOrderFile(w http.ResponseWriter, r *http.Request, orderId string, fileId openapi_types.UUID) {
	if s.cfg.Store == nil || s.cfg.Storage == nil {
		internalError(w, "store/storage not configured")
		return
	}
	ctx := r.Context()
	f, err := s.cfg.Store.GetOrderFileForDownload(ctx, store.GetOrderFileForDownloadParams{
		ShortID: orderId, ID: fileId,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, FileNotFound, "file not found for this order", nil)
			return
		}
		s.cfg.Logger.Error("download: lookup failed", "orderId", orderId, "fileId", fileId, "err", err)
		internalError(w, "failed to load file")
		return
	}
	if f.StorageKey == nil {
		apiError(w, http.StatusNotFound, FileNotFound, "file bytes not stored", nil)
		return
	}
	rc, err := s.cfg.Storage.Get(ctx, *f.StorageKey)
	if err != nil {
		s.cfg.Logger.Error("download: storage get failed", "orderId", orderId, "fileId", fileId, "err", err)
		internalError(w, "failed to read file")
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename*=UTF-8''%s", encodeURIComponent(f.FileName)))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", f.FileSizeBytes))
	w.WriteHeader(http.StatusOK)
	if _, err := io.Copy(w, rc); err != nil {
		s.cfg.Logger.Warn("download: stream failed", "orderId", orderId, "fileId", fileId, "err", err)
	}
}
