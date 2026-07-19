package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JamesHawking/print-cut-ship/backend/internal/leadtime"
	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
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
	days := 0
	for _, id := range leadTimeIDs {
		if lt, ok := priceCfg.LeadTime(id); ok && lt.BusinessDays > days {
			days = lt.BusinessDays
		}
	}
	sd := leadtime.ComputeShipDate(days, priceCfg.SameDayCutoffHour, paidAt.Time)
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
	items, err := s.cfg.Store.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil {
		s.cfg.Logger.Error("admin get order: items failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load order items")
		return
	}
	payments, err := s.cfg.Store.ListPaymentsByOrderID(ctx, o.ID)
	if err != nil {
		s.cfg.Logger.Error("admin get order: payments failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load payments")
		return
	}
	invoices, err := s.cfg.Store.ListInvoicesByOrderID(ctx, o.ID)
	if err != nil {
		s.cfg.Logger.Error("admin get order: invoices failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load invoices")
		return
	}

	var totals OrderTotals
	if err := json.Unmarshal(o.PricingSnapshot, &totals); err != nil {
		s.cfg.Logger.Error("admin get order: snapshot decode failed", "orderId", orderId, "err", err)
		internalError(w, "failed to read order totals")
		return
	}
	var shipping Address
	if err := json.Unmarshal(o.ShippingAddress, &shipping); err != nil {
		s.cfg.Logger.Error("admin get order: address decode failed", "orderId", orderId, "err", err)
		internalError(w, "failed to read order address")
		return
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
			s.cfg.Logger.Error("admin get order: billing decode failed", "orderId", orderId, "err", err)
			internalError(w, "failed to read order address")
			return
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

	writeJSON(w, http.StatusOK, AdminOrderDetail{
		Order:    order,
		Items:    viewItems,
		Payments: viewPayments,
		Invoices: viewInvoices,
	})
}
