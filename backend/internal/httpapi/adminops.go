package httpapi

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"

	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/leadtime"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// AdminGetOpsToday answers "what must ship today": paid + in_production
// orders whose derived ship-by is today or earlier (Warsaw calendar),
// soonest first. Ship dates recompute from the lead-time engine — there is
// no denormalized ship-date column to drift. Guarded by adminPrefixGuard.
func (s *server) AdminGetOpsToday(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	rows, err := s.cfg.Store.AdminListOpenOrders(r.Context())
	if err != nil {
		s.cfg.Logger.Error("ops: load open orders failed", "err", err)
		internalError(w, "failed to load open orders")
		return
	}

	today := leadtime.Today(s.now())
	type dueOrder struct {
		sum  AdminOrderSummary
		ship leadtime.CalDate
	}
	due := make([]dueOrder, 0, len(rows))
	for _, row := range rows {
		ship := s.shipBy(row.Status, row.LeadTimes, row.PaidAt)
		if ship == nil || today.Before(*ship) {
			continue // not due yet (or unanchored)
		}
		sum := s.adminOrderSummary(store.AdminListOrdersRow(row))
		due = append(due, dueOrder{sum: sum, ship: *ship})
	}
	sort.Slice(due, func(i, j int) bool {
		return due[i].ship.Before(due[j].ship) ||
			(due[i].ship == due[j].ship && due[i].sum.CreatedAt.Before(due[j].sum.CreatedAt))
	})

	orders := make([]AdminOrderSummary, 0, len(due))
	for _, d := range due {
		orders = append(orders, d.sum)
	}
	writeJSON(w, http.StatusOK, AdminOpsToday{
		Date:   today.ISO(),
		Orders: orders,
	})
}

// AdminListStepRequests is the STEP manual-quote queue. Guarded by
// adminPrefixGuard.
func (s *server) AdminListStepRequests(w http.ResponseWriter, r *http.Request, params AdminListStepRequestsParams) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	var status *string
	if params.Status != nil {
		st := string(*params.Status)
		status = &st
	}
	rows, err := s.cfg.Store.ListStepRequests(r.Context(), status)
	if err != nil {
		s.cfg.Logger.Error("step queue: list failed", "err", err)
		internalError(w, "failed to list step requests")
		return
	}
	requests := make([]AdminStepRequestSummary, 0, len(rows))
	for _, sr := range rows {
		requests = append(requests, adminStepRequestView(sr))
	}
	writeJSON(w, http.StatusOK, AdminStepRequestList{Requests: requests})
}

func adminStepRequestView(sr store.StepRequest) AdminStepRequestSummary {
	return AdminStepRequestSummary{
		RequestId:     sr.ShortID,
		Email:         sr.Email,
		FileName:      sr.FileName,
		FileSizeBytes: sr.FileSizeBytes,
		Status:        AdminStepRequestSummaryStatus(sr.Status),
		FileId:        sr.FileID,
		CreatedAt:     sr.CreatedAt.Time,
	}
}

// AdminUpdateStepRequestStatus advances a request to quoted or closed.
// Closed is terminal (SQL-guarded; 0 rows → 409). Guarded by
// adminPrefixGuard.
func (s *server) AdminUpdateStepRequestStatus(w http.ResponseWriter, r *http.Request, requestId string) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	var req UpdateStepRequestStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}
	ctx := r.Context()
	sr, err := s.cfg.Store.GetStepRequestByShortID(ctx, requestId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, StepRequestNotFound, "step request not found", nil)
			return
		}
		s.cfg.Logger.Error("step queue: load failed", "requestId", requestId, "err", err)
		internalError(w, "failed to load step request")
		return
	}
	updated, err := s.cfg.Store.UpdateStepRequestStatus(ctx, store.UpdateStepRequestStatusParams{
		ShortID: sr.ShortID,
		Status:  string(req.Status),
	})
	if err != nil {
		s.cfg.Logger.Error("step queue: update failed", "requestId", requestId, "err", err)
		internalError(w, "failed to update step request")
		return
	}
	if updated == 0 {
		apiError(w, http.StatusConflict, StepRequestWrongState,
			fmt.Sprintf("step request is %s (closed is terminal)", sr.Status),
			map[string]any{"from": sr.Status, "to": string(req.Status)})
		return
	}
	s.cfg.Logger.Info("step request status updated",
		"requestId", sr.ShortID, "from", sr.Status, "to", string(req.Status))
	w.WriteHeader(http.StatusNoContent)
}

// AdminDownloadStepRequestFile streams the STEP file attached to the request
// (the operator needs the geometry to price it manually). Guarded by
// adminPrefixGuard.
func (s *server) AdminDownloadStepRequestFile(w http.ResponseWriter, r *http.Request, requestId string) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	ctx := r.Context()
	sr, err := s.cfg.Store.GetStepRequestByShortID(ctx, requestId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, StepRequestNotFound, "step request not found", nil)
			return
		}
		s.cfg.Logger.Error("step file: load request failed", "requestId", requestId, "err", err)
		internalError(w, "failed to load step request")
		return
	}
	if sr.FileID == nil {
		apiError(w, http.StatusNotFound, FileNotFound, "no file attached to this request", nil)
		return
	}
	f, err := s.cfg.Store.GetFileByID(ctx, *sr.FileID)
	if err != nil || f.StorageKey == nil || f.DeletedAt.Valid {
		apiError(w, http.StatusNotFound, FileNotFound, "file bytes not stored", nil)
		return
	}
	if s.cfg.Storage == nil {
		internalError(w, "storage not configured")
		return
	}
	rc, err := s.cfg.Storage.Get(ctx, *f.StorageKey)
	if err != nil {
		s.cfg.Logger.Error("step file: storage get failed", "requestId", requestId, "err", err)
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
		s.cfg.Logger.Warn("step file: stream failed", "requestId", requestId, "err", err)
	}
}
