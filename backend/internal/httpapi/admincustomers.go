package httpapi

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// customerTrail gathers everything keyed to an email (guests included — email
// is the join key). Shared by lookup and export.
type customerTrail struct {
	user         *AdminUserSummary
	orders       []AdminOrderSummary
	orderIDs     []string
	quotes       []AdminQuoteSummary
	stepRequests []AdminStepRequestSummary
	files        []AdminFileSummary
}

func (s *server) loadCustomerTrail(r *http.Request, email string) (*customerTrail, error) {
	ctx := r.Context()
	trail := &customerTrail{
		orders:       []AdminOrderSummary{},
		quotes:       []AdminQuoteSummary{},
		stepRequests: []AdminStepRequestSummary{},
		files:        []AdminFileSummary{},
	}

	u, err := s.cfg.Store.GetUserByEmail(ctx, email)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return nil, err
	default:
		trail.user = &AdminUserSummary{
			Id:        u.ID,
			Email:     u.Email,
			Role:      u.Role,
			CreatedAt: u.CreatedAt.Time,
		}
	}

	orders, err := s.cfg.Store.AdminListOrdersByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	for _, row := range orders {
		trail.orders = append(trail.orders, s.adminOrderSummary(store.AdminListOrdersRow(row)))
		trail.orderIDs = append(trail.orderIDs, row.ShortID)
	}

	quotes, err := s.cfg.Store.ListQuotesByEmail(ctx, &email)
	if err != nil {
		return nil, err
	}
	for _, q := range quotes {
		trail.quotes = append(trail.quotes, AdminQuoteSummary{
			QuoteId:       q.ShortID,
			Status:        q.Status,
			GrossTotalPln: money.FromGrosze(q.GrossTotalGrosze),
			CreatedAt:     q.CreatedAt.Time,
			PartCount:     int(q.PartCount),
			FileName:      &q.FirstFileName,
		})
	}

	srs, err := s.cfg.Store.ListStepRequestsByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	for _, sr := range srs {
		trail.stepRequests = append(trail.stepRequests, AdminStepRequestSummary{
			RequestId:     sr.ShortID,
			FileName:      sr.FileName,
			FileSizeBytes: sr.FileSizeBytes,
			Status:        AdminStepRequestSummaryStatus(sr.Status),
			FileId:        sr.FileID,
			CreatedAt:     sr.CreatedAt.Time,
		})
	}

	files, err := s.cfg.Store.AdminListFilesByEmail(ctx, &email)
	if err != nil {
		return nil, err
	}
	for _, f := range files {
		trail.files = append(trail.files, AdminFileSummary{
			FileId:    f.ID,
			FileName:  f.FileName,
			Kind:      f.Kind,
			SizeBytes: f.FileSizeBytes,
			Stored:    f.Stored,
			CreatedAt: f.CreatedAt.Time,
		})
	}
	return trail, nil
}

// AdminLookupCustomer is the support view: the full trail for one email.
// Unknown emails return empty arrays (never 404 — support shouldn't have to
// guess which table the email lives in). Guarded by adminPrefixGuard.
func (s *server) AdminLookupCustomer(w http.ResponseWriter, r *http.Request, params AdminLookupCustomerParams) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	email := string(params.Email)
	if !validEmail(email) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	trail, err := s.loadCustomerTrail(r, email)
	if err != nil {
		s.cfg.Logger.Error("customer lookup failed", "email", email, "err", err)
		internalError(w, "failed to look up customer")
		return
	}
	writeJSON(w, http.StatusOK, AdminCustomerLookup{
		Email:        email,
		User:         trail.user,
		Orders:       trail.orders,
		Quotes:       trail.quotes,
		StepRequests: trail.stepRequests,
		Files:        trail.files,
	})
}

// AdminExportCustomer is the GDPR data-portability bundle: orders in full
// detail shape (items, payments, invoices). Guarded by adminPrefixGuard.
func (s *server) AdminExportCustomer(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	var req CustomerEmailRequest
	if !decodeBody(w, r, &req) {
		return
	}
	email := string(req.Email)
	if !validEmail(email) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	trail, err := s.loadCustomerTrail(r, email)
	if err != nil {
		s.cfg.Logger.Error("customer export failed", "email", email, "err", err)
		internalError(w, "failed to export customer")
		return
	}

	details := make([]AdminOrderDetail, 0, len(trail.orderIDs))
	for _, shortID := range trail.orderIDs {
		o, err := s.cfg.Store.GetOrderByShortID(r.Context(), shortID)
		if err != nil {
			s.cfg.Logger.Error("customer export: load order failed", "orderId", shortID, "err", err)
			internalError(w, "failed to export customer")
			return
		}
		detail, err := s.buildOrderDetail(r.Context(), o)
		if err != nil {
			s.cfg.Logger.Error("customer export: build detail failed", "orderId", shortID, "err", err)
			internalError(w, "failed to export customer")
			return
		}
		details = append(details, detail)
	}
	s.cfg.Logger.Info("customer exported (GDPR)", "email", email, "orders", len(details))
	writeJSON(w, http.StatusOK, AdminCustomerExport{
		Email:        email,
		ExportedAt:   s.now(),
		User:         trail.user,
		Orders:       details,
		Quotes:       trail.quotes,
		StepRequests: trail.stepRequests,
		Files:        trail.files,
	})
}

// eraseRetentionReason explains the plan-09 carve-out on retained entries.
const eraseRetentionReason = "invoice/accounting retention (retention_until or invoice rows) — plan 09 owns the deletion policy"

// AdminEraseCustomer is DRY-RUN ONLY: it reports what a real erasure would
// delete vs retain. There is deliberately no destructive code path — plan 09
// signs off on deletion order and enables it. Guarded by adminPrefixGuard.
func (s *server) AdminEraseCustomer(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	var req EraseCustomerRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !req.DryRun {
		badRequest(w, EraseNotEnabled, "erasure is dry-run only until plan 09", nil)
		return
	}
	email := string(req.Email)
	if !validEmail(email) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}

	ctx := r.Context()
	st := s.cfg.Store
	count := func(name string, fn func() (int32, error)) (int32, error) {
		n, err := fn()
		if err != nil {
			s.cfg.Logger.Error("erase dry-run count failed", "table", name, "err", err)
		}
		return n, err
	}
	var reportErr error
	must := func(name string, fn func() (int32, error)) int32 {
		if reportErr != nil {
			return 0
		}
		n, err := count(name, fn)
		if err != nil {
			reportErr = err
		}
		return n
	}

	users := must("users", func() (int32, error) { return st.AdminCountUserByEmail(ctx, email) })
	sessions := must("sessions", func() (int32, error) { return st.AdminCountSessionsByEmail(ctx, email) })
	quotes := must("quotes", func() (int32, error) { return st.AdminCountQuotesByEmail(ctx, &email) })
	quoteParts := must("quote_parts", func() (int32, error) { return st.AdminCountQuotePartsByEmail(ctx, &email) })
	deletableOrders := must("orders", func() (int32, error) {
		return st.AdminCountOrdersByRetention(ctx, store.AdminCountOrdersByRetentionParams{Email: email, Retained: false})
	})
	deletableItems := must("order_items", func() (int32, error) {
		return st.AdminCountOrderItemsByRetention(ctx, store.AdminCountOrderItemsByRetentionParams{Email: email, Retained: false})
	})
	deletablePayments := must("payments", func() (int32, error) {
		return st.AdminCountPaymentsByRetention(ctx, store.AdminCountPaymentsByRetentionParams{Email: email, Retained: false})
	})
	deletableFiles := must("files", func() (int32, error) { return st.AdminCountDeletableFilesByEmail(ctx, &email) })
	stepRequests := must("step_requests", func() (int32, error) { return st.AdminCountStepRequestsByEmail(ctx, email) })
	retainedOrders := must("orders (retained)", func() (int32, error) {
		return st.AdminCountOrdersByRetention(ctx, store.AdminCountOrdersByRetentionParams{Email: email, Retained: true})
	})
	invoices := must("invoices", func() (int32, error) { return st.AdminCountInvoicesByEmail(ctx, email) })
	retainedFiles := must("files (retained)", func() (int32, error) { return st.AdminCountRetainedFilesByEmail(ctx, email) })
	if reportErr != nil {
		internalError(w, "failed to build erase report")
		return
	}

	wouldDelete := []AdminEraseEntry{
		{Table: "users", Count: int(users)},
		{Table: "sessions", Count: int(sessions)},
		{Table: "quotes", Count: int(quotes)},
		{Table: "quote_parts", Count: int(quoteParts)},
		{Table: "orders", Count: int(deletableOrders), Note: strPtr("only orders without the invoice-retention carve-out")},
		{Table: "order_items", Count: int(deletableItems)},
		{Table: "payments", Count: int(deletablePayments)},
		{Table: "files", Count: int(deletableFiles), Note: strPtr("storage objects would be removed too; files a retained order needs stay")},
		{Table: "step_requests", Count: int(stepRequests)},
	}
	retained := []AdminEraseRetained{}
	if retainedOrders > 0 {
		retained = append(retained, AdminEraseRetained{
			Table: "orders", Count: int(retainedOrders), Reason: eraseRetentionReason,
		})
	}
	if invoices > 0 {
		retained = append(retained, AdminEraseRetained{
			Table: "invoices", Count: int(invoices), Reason: eraseRetentionReason,
		})
	}
	if retainedFiles > 0 {
		retained = append(retained, AdminEraseRetained{
			Table: "files", Count: int(retainedFiles), Reason: eraseRetentionReason,
		})
	}

	writeJSON(w, http.StatusOK, AdminEraseReport{
		Email:       email,
		DryRun:      true,
		WouldDelete: wouldDelete,
		Retained:    retained,
	})
}

func strPtr(s string) *string { return &s }
