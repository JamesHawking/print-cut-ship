package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
	"github.com/JamesHawking/print-cut-ship/backend/internal/orders"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// CreateOrder converts a persisted quote into a draft order (plan 05). The
// anti-tamper boundary: the request carries no prices at all — every money
// value is copied verbatim from the stored, server-recomputed quote rows.
func (s *server) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !validEmail(string(req.Email)) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	if !euCountries[req.Country] {
		badRequest(w, UnsupportedCountry,
			fmt.Sprintf("unsupported country %q", req.Country),
			map[string]any{"country": string(req.Country)})
		return
	}
	if req.Nip != nil && *req.Nip != "" && !orders.ValidNIP(*req.Nip) {
		badRequest(w, InvalidNip, "invalid NIP checksum", nil)
		return
	}
	if !validAddress(req.ShippingAddress) ||
		(req.BillingAddress != nil && !validAddress(*req.BillingAddress)) {
		badRequest(w, InvalidBody, "address fields must be non-empty", nil)
		return
	}
	if s.cfg.Store == nil {
		s.cfg.Logger.Warn("store not configured; cannot create order")
		internalError(w, "store not configured")
		return
	}

	ctx := r.Context()
	quote, err := s.cfg.Store.GetQuoteByShortID(ctx, req.QuoteId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, QuoteNotFound, "quote not found", nil)
			return
		}
		s.cfg.Logger.Error("create order: load quote failed", "quoteId", req.QuoteId, "err", err)
		internalError(w, "failed to load quote")
		return
	}
	if quote.Status != "submitted" {
		apiError(w, http.StatusConflict, QuoteAlreadyOrdered,
			fmt.Sprintf("quote already converted (status %s)", quote.Status),
			map[string]any{"status": quote.Status})
		return
	}
	parts, err := s.cfg.Store.GetQuotePartsByQuoteID(ctx, quote.ID)
	if err != nil {
		s.cfg.Logger.Error("create order: load quote parts failed", "quoteId", req.QuoteId, "err", err)
		internalError(w, "failed to load quote parts")
		return
	}
	if len(parts) == 0 {
		badRequest(w, PartsCount, "quote has no parts", nil)
		return
	}

	// File gate: every part must be backed by a stored (uploaded, undeleted)
	// file — production needs the actual geometry (plan 02).
	if err := s.gateQuoteFiles(ctx, parts); err != nil {
		badRequest(w, QuoteFileInvalid, err.Error(), nil)
		return
	}

	params, items, err := s.buildOrder(ctx, req, quote, parts)
	if err != nil {
		s.cfg.Logger.Error("create order: build failed", "quoteId", req.QuoteId, "err", err)
		internalError(w, "failed to build order")
		return
	}
	row, err := s.cfg.Store.CreateOrder(ctx, *params, items)
	if err != nil {
		s.cfg.Logger.Error("create order: persist failed", "quoteId", req.QuoteId, "err", err)
		internalError(w, "failed to persist order")
		return
	}
	s.cfg.Logger.Info("order created",
		"orderId", row.ShortID, "quoteId", req.QuoteId, "email", string(req.Email))

	// Plan 06: order confirmation in the order's locale, with the tokenized
	// status-page link. Deduped on the order id; mail never fails the order.
	data := email.OrderData{
		OrderShortID: row.ShortID,
		GrossTotal:   email.FormatPLN(params.GrossTotalGrosze, params.Locale),
		StatusURL:    s.pageURL(params.Locale, "/order/"+params.StatusToken),
	}
	for _, it := range items {
		data.Items = append(data.Items, email.OrderItemData{
			FileName:  it.FileName,
			Quantity:  it.Quantity,
			LineTotal: email.FormatPLN(it.LineTotalGrosze, params.Locale),
		})
	}
	s.sendMail(ctx, email.Input{
		To: string(req.Email), Template: email.OrderConfirmation, Locale: params.Locale,
		DedupeKey: "order_confirmation:" + row.ShortID,
		OrderID:   &row.ID, UserID: params.UserID,
		Data: data,
	})

	writeJSON(w, http.StatusOK, CreateOrderResponse{
		OrderId:     row.ShortID,
		StatusToken: params.StatusToken,
	})
}

// CreateOrderCheckout returns the provider checkout URL for a draft order,
// creating the session on first call and returning the live one afterwards
// (Stripe Checkout semantics: a session is reusable until it expires).
func (s *server) CreateOrderCheckout(w http.ResponseWriter, r *http.Request, orderId string) {
	if s.cfg.Store == nil || s.cfg.Payments == nil {
		s.cfg.Logger.Warn("store/payments not configured; cannot checkout")
		internalError(w, "payments not configured")
		return
	}
	ctx := r.Context()
	o, err := s.cfg.Store.GetOrderByShortID(ctx, orderId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, OrderNotFound, "order not found", nil)
			return
		}
		s.cfg.Logger.Error("checkout: load order failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load order")
		return
	}
	if o.Status != string(orders.StatusDraft) {
		apiError(w, http.StatusConflict, OrderWrongState,
			fmt.Sprintf("order is %s, not draft", o.Status),
			map[string]any{"status": o.Status})
		return
	}
	if o.CheckoutSessionUrl != nil && o.CheckoutSessionExpiresAt.Valid &&
		time.Now().Before(o.CheckoutSessionExpiresAt.Time) {
		writeJSON(w, http.StatusOK, CheckoutResponse{Url: *o.CheckoutSessionUrl})
		return
	}

	sess, err := s.cfg.Payments.CreateCheckoutSession(ctx, payments.CheckoutParams{
		OrderShortID:     o.ShortID,
		GrossTotalGrosze: o.GrossTotalGrosze,
		SuccessURL:       s.pageURL(o.Locale, "/order/"+o.StatusToken),
		CancelURL:        s.pageURL(o.Locale, "/quote"),
		Locale:           o.Locale,
	})
	if err != nil {
		s.cfg.Logger.Error("checkout: provider session failed", "orderId", orderId, "err", err)
		internalError(w, "failed to create checkout session")
		return
	}
	if err := s.cfg.Store.SetOrderCheckoutSession(ctx, store.SetOrderCheckoutSessionParams{
		ID:                       o.ID,
		CheckoutSessionID:        &sess.ID,
		CheckoutSessionUrl:       &sess.URL,
		CheckoutSessionExpiresAt: timestamptz(sess.ExpiresAt),
	}); err != nil {
		s.cfg.Logger.Error("checkout: persist session failed", "orderId", orderId, "err", err)
		internalError(w, "failed to persist checkout session")
		return
	}
	writeJSON(w, http.StatusOK, CheckoutResponse{Url: sess.URL})
}

// TrackOrder is the public, tokenized status view. The statusToken is the
// bearer capability; the response is redacted (no internal ids, no PII beyond
// the line items, no raw provider objects).
func (s *server) TrackOrder(w http.ResponseWriter, r *http.Request, statusToken string) {
	if s.cfg.Store == nil {
		apiError(w, http.StatusNotFound, OrderNotFound, "order not found", nil)
		return
	}
	ctx := r.Context()
	o, err := s.cfg.Store.GetOrderByStatusToken(ctx, statusToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, OrderNotFound, "order not found", nil)
			return
		}
		s.cfg.Logger.Error("track: load order failed", "err", err)
		internalError(w, "failed to load order")
		return
	}
	items, err := s.cfg.Store.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil {
		s.cfg.Logger.Error("track: load items failed", "orderId", o.ShortID, "err", err)
		internalError(w, "failed to load order items")
		return
	}
	var totals OrderTotals
	if err := json.Unmarshal(o.PricingSnapshot, &totals); err != nil {
		s.cfg.Logger.Error("track: snapshot decode failed", "orderId", o.ShortID, "err", err)
		internalError(w, "failed to read order totals")
		return
	}
	view := TrackedOrder{
		OrderId:   o.ShortID,
		Status:    OrderStatus(o.Status),
		CreatedAt: o.CreatedAt.Time,
		Items:     make([]TrackedOrderItem, 0, len(items)),
		Totals:    totals,
	}
	if o.PaidAt.Valid {
		t := o.PaidAt.Time
		view.PaidAt = &t
	}
	for _, it := range items {
		view.Items = append(view.Items, TrackedOrderItem{
			FileName:     it.FileName,
			Process:      ProcessId(it.Process),
			Quantity:     int(it.Quantity),
			LeadTime:     LeadTimeId(it.LeadTime),
			UnitPricePln: money.FromGrosze(it.UnitPriceGrosze),
			LineTotalPln: money.FromGrosze(it.LineTotalGrosze),
		})
	}
	writeJSON(w, http.StatusOK, view)
}

// RefundOrder initiates a provider refund for a paid order. The status flip
// is the pipeline's job (request/confirm split): the stub confirms
// synchronously in-process; Stripe's webhook confirms in plan 18. The inline
// guard is defense-in-depth under plan 07's adminPrefixGuard, which already
// fail-closes every /api/v1/admin/* path (generated chi mounts can't be
// wrapped per-route).
func (s *server) RefundOrder(w http.ResponseWriter, r *http.Request, orderId string) {
	if s.requireAdmin(w, r) == nil {
		return
	}
	if s.cfg.Store == nil || s.cfg.Payments == nil {
		internalError(w, "payments not configured")
		return
	}
	ctx := r.Context()
	o, err := s.cfg.Store.GetOrderByShortID(ctx, orderId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, OrderNotFound, "order not found", nil)
			return
		}
		s.cfg.Logger.Error("refund: load order failed", "orderId", orderId, "err", err)
		internalError(w, "failed to load order")
		return
	}
	if err := orders.AssertTransition(orders.Status(o.Status), orders.StatusRefunded); err != nil {
		apiError(w, http.StatusConflict, OrderWrongState, err.Error(),
			map[string]any{"status": o.Status})
		return
	}
	if o.PaymentRef == nil {
		apiError(w, http.StatusConflict, OrderWrongState, "order has no payment to refund",
			map[string]any{"status": o.Status})
		return
	}
	if _, err := s.cfg.Payments.Refund(ctx, *o.PaymentRef, o.GrossTotalGrosze); err != nil {
		s.cfg.Logger.Error("refund: provider failed", "orderId", orderId, "err", err)
		internalError(w, "refund failed")
		return
	}
	s.cfg.Logger.Info("refund requested", "orderId", orderId)
	w.WriteHeader(http.StatusNoContent)
}

// stubComplete is the fake-checkout confirmation endpoint (registered only
// when PAYMENTS_PROVIDER=stub). It feeds the synthetic provider event into
// the same pipeline the Stripe webhook will feed in plan 18.
func (s *server) stubComplete(w http.ResponseWriter, r *http.Request) {
	stub, ok := s.cfg.Payments.(*payments.Stub)
	if !ok || s.cfg.Pipeline == nil || s.cfg.Store == nil {
		apiError(w, http.StatusNotFound, OrderNotFound, "not found", nil)
		return
	}
	var req struct {
		Session string `json:"session"`
		Outcome string `json:"outcome"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	o, err := s.cfg.Store.GetOrderByCheckoutSessionID(r.Context(), &req.Session)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, OrderNotFound, "unknown session", nil)
			return
		}
		s.cfg.Logger.Error("stub complete: load order failed", "err", err)
		internalError(w, "failed to load order")
		return
	}
	ev := stub.CompleteEvent(o.ShortID, o.GrossTotalGrosze)
	if req.Outcome == "fail" {
		ev = stub.FailedEvent(o.ShortID, o.GrossTotalGrosze)
	}
	if err := s.cfg.Pipeline.ProcessEvent(r.Context(), ev); err != nil {
		s.cfg.Logger.Error("stub complete: pipeline failed", "orderId", o.ShortID, "err", err)
		internalError(w, "failed to process payment event")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ------------------------------------------------------------------ helpers

func validAddress(a Address) bool {
	return a.Name != "" && a.Street != "" && a.City != "" && a.PostalCode != ""
}

// requireAdmin writes 401 (anonymous) / 403 (non-admin) and returns nil, or
// returns the admin user. The inline counterpart of RequireAdmin for
// generated route mounts.
func (s *server) requireAdmin(w http.ResponseWriter, r *http.Request) *auth.User {
	u := CurrentUser(r.Context())
	if u == nil {
		apiError(w, http.StatusUnauthorized, Unauthorized, "authentication required", nil)
		return nil
	}
	if u.Role != "admin" {
		apiError(w, http.StatusForbidden, Unauthorized, "admin role required", nil)
		return nil
	}
	return u
}

func timestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// makeStatusToken mints the order's public status-page capability: 256 bits,
// URL-safe. Stored plaintext (plan 06 embeds status URLs in emails, so the
// server must be able to re-derive them) — flagged for plan 10 review.
func makeStatusToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// pageURL builds an absolute frontend URL for provider redirects.
func (s *server) pageURL(locale, path string) string {
	return fmt.Sprintf("%s/%s%s", s.cfg.PublicBaseURL, locale, path)
}

// orderEmailData builds the shared payload for order lifecycle emails (plan
// 06) from a stored order row: items, preformatted money, status-page link.
func (s *server) orderEmailData(ctx context.Context, o store.Order) (email.OrderData, error) {
	items, err := s.cfg.Store.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil {
		return email.OrderData{}, fmt.Errorf("load order items: %w", err)
	}
	data := email.OrderData{
		OrderShortID: o.ShortID,
		GrossTotal:   email.FormatPLN(o.GrossTotalGrosze, o.Locale),
		StatusURL:    s.pageURL(o.Locale, "/order/"+o.StatusToken),
	}
	for _, it := range items {
		data.Items = append(data.Items, email.OrderItemData{
			FileName:  it.FileName,
			Quantity:  it.Quantity,
			LineTotal: email.FormatPLN(it.LineTotalGrosze, o.Locale),
		})
	}
	return data, nil
}

// gateQuoteFiles enforces the plan-02 boundary: every quote part must
// reference a stored (uploaded, undeleted) file.
func (s *server) gateQuoteFiles(ctx context.Context, parts []store.QuotePart) error {
	seen := map[uuid.UUID]bool{}
	var ids []uuid.UUID
	for _, p := range parts {
		if p.FileID == nil {
			return fmt.Errorf("part %s has no stored file", p.FileName)
		}
		if !seen[*p.FileID] {
			seen[*p.FileID] = true
			ids = append(ids, *p.FileID)
		}
	}
	stored, err := s.cfg.Store.CountStoredFilesByIDs(ctx, ids)
	if err != nil {
		return fmt.Errorf("file gate lookup: %w", err)
	}
	if int(stored) != len(ids) {
		return fmt.Errorf("%d of %d files are not stored", len(ids)-int(stored), len(ids))
	}
	return nil
}

// buildOrder maps the request + stored quote rows to insert params. All money
// comes from the quote row (integer grosze, server-recomputed at intake) —
// the request contributes only identity/address/invoice fields.
func (s *server) buildOrder(ctx context.Context, req CreateOrderRequest, quote store.Quote, parts []store.QuotePart) (*store.InsertOrderParams, []store.InsertOrderItemParams, error) {
	snapshot, err := json.Marshal(OrderTotals{
		PartsSubtotalPln: money.FromGrosze(quote.PartsSubtotalGrosze),
		MinOrderTopUpPln: money.FromGrosze(quote.MinOrderTopupGrosze),
		OrderFeePln:      money.FromGrosze(quote.OrderFeeGrosze),
		ShippingPln:      money.FromGrosze(quote.ShippingGrosze),
		NetTotalPln:      money.FromGrosze(quote.NetTotalGrosze),
		VatPln:           money.FromGrosze(quote.VatGrosze),
		GrossTotalPln:    money.FromGrosze(quote.GrossTotalGrosze),
		FreeShipping:     quote.FreeShipping,
		MinOrderApplied:  quote.MinOrderApplied,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("marshal pricing snapshot: %w", err)
	}
	shipping, err := json.Marshal(req.ShippingAddress)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal shipping address: %w", err)
	}
	var billing []byte
	if req.BillingAddress != nil {
		if billing, err = json.Marshal(req.BillingAddress); err != nil {
			return nil, nil, fmt.Errorf("marshal billing address: %w", err)
		}
	}

	params := &store.InsertOrderParams{
		ShortID:          makeID("O"),
		QuoteID:          quote.ID,
		Email:            string(req.Email),
		Status:           string(orders.StatusDraft),
		GrossTotalGrosze: quote.GrossTotalGrosze,
		VatGrosze:        quote.VatGrosze,
		PricingConfigID:  quote.PricingConfigID,
		PricingSnapshot:  snapshot,
		Locale:           quote.Locale,
		Country:          string(req.Country),
		CompanyName:      req.CompanyName,
		ShippingAddress:  shipping,
		BillingAddress:   billing,
		StatusToken:      makeStatusToken(),
	}
	if u := CurrentUser(ctx); u != nil {
		params.UserID = &u.ID
	}
	if req.Nip != nil && *req.Nip != "" {
		params.Nip = req.Nip
	}
	if req.InvoiceRequested != nil && *req.InvoiceRequested {
		params.InvoiceRequested = true
	}

	items := make([]store.InsertOrderItemParams, 0, len(parts))
	for _, p := range parts {
		snap, err := partSnapshot(p)
		if err != nil {
			return nil, nil, err
		}
		items = append(items, store.InsertOrderItemParams{
			FileID:            p.FileID,
			FileName:          p.FileName,
			Hash:              p.Hash,
			Process:           p.Process,
			Quantity:          p.Quantity,
			LeadTime:          p.LeadTime,
			UnitPriceGrosze:   p.UnitPriceGrosze,
			LineTotalGrosze:   p.LineTotalGrosze,
			PartQuoteSnapshot: snap,
		})
	}
	return params, items, nil
}

// partSnapshot freezes one quote_parts row as the order item's immutable copy
// (breakdown/dfmFlags pass through as stored jsonb; money back to PLN floats
// matching the API surface).
func partSnapshot(p store.QuotePart) ([]byte, error) {
	type snapshot struct {
		FileName          string          `json:"fileName"`
		Hash              string          `json:"hash"`
		Process           string          `json:"process"`
		Quantity          int32           `json:"quantity"`
		LeadTime          string          `json:"leadTime"`
		UnitPricePln      float64         `json:"unitPricePln"`
		LineTotalPln      float64         `json:"lineTotalPln"`
		BillableVolumeCm3 *float64        `json:"billableVolumeCm3,omitempty"`
		PieceCount        *int32          `json:"pieceCount,omitempty"`
		Plates            *int32          `json:"plates,omitempty"`
		Breakdown         json.RawMessage `json:"breakdown,omitempty"`
		DfmFlags          json.RawMessage `json:"dfmFlags,omitempty"`
	}
	out, err := json.Marshal(snapshot{
		FileName:          p.FileName,
		Hash:              p.Hash,
		Process:           p.Process,
		Quantity:          p.Quantity,
		LeadTime:          p.LeadTime,
		UnitPricePln:      money.FromGrosze(p.UnitPriceGrosze),
		LineTotalPln:      money.FromGrosze(p.LineTotalGrosze),
		BillableVolumeCm3: p.BillableVolumeCm3,
		PieceCount:        p.PieceCount,
		Plates:            p.Plates,
		Breakdown:         p.Breakdown,
		DfmFlags:          p.DfmFlags,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal part snapshot: %w", err)
	}
	return out, nil
}
