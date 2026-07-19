package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
)

// pricingSwapMu serializes publish operations: persist the new active
// snapshot, THEN swap the in-process holder — never the other way around, so
// a failed persist can never leave the engine running an unpersisted config.
var pricingSwapMu sync.Mutex

// snapshotView maps a stored row to the wire shape, strict-decoding the
// config JSON into the spec-typed form (the same parity the drift-guard
// test pins against json.Marshal(pricing.Default)).
func (s *server) snapshotView(id openapi_types.UUID, label string, createdAt time.Time, isActive bool, raw []byte) (PricingConfigSnapshot, error) {
	var cfg PricingConfig
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&cfg); err != nil {
		return PricingConfigSnapshot{}, err
	}
	return PricingConfigSnapshot{
		Id:        id,
		Label:     label,
		CreatedAt: createdAt,
		IsActive:  isActive,
		Config:    cfg,
	}, nil
}

// AdminGetPricingConfig returns the active snapshot plus version history.
// Guarded by adminPrefixGuard.
func (s *server) AdminGetPricingConfig(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	ctx := r.Context()
	active, err := s.cfg.Store.GetActivePricingConfig(ctx)
	if err != nil {
		s.cfg.Logger.Error("pricing-config: load active failed", "err", err)
		internalError(w, "failed to load active pricing config")
		return
	}
	rows, err := s.cfg.Store.ListPricingConfigSnapshots(ctx)
	if err != nil {
		s.cfg.Logger.Error("pricing-config: history failed", "err", err)
		internalError(w, "failed to load pricing config history")
		return
	}

	activeView, err := s.snapshotView(active.ID, active.Label, active.CreatedAt.Time, true, active.Config)
	if err != nil {
		s.cfg.Logger.Error("pricing-config: active row does not decode", "id", active.ID, "err", err)
		internalError(w, "active pricing config does not decode")
		return
	}
	history := make([]PricingConfigSnapshotMeta, 0, len(rows))
	for _, row := range rows {
		history = append(history, PricingConfigSnapshotMeta{
			Id:        row.ID,
			Label:     row.Label,
			CreatedAt: row.CreatedAt.Time,
			IsActive:  row.IsActive,
		})
	}
	writeJSON(w, http.StatusOK, AdminPricingConfigResponse{
		Active:  activeView,
		History: history,
	})
}

// AdminGetPricingConfigSnapshot reads one historical snapshot (load-into-form
// in the editor). Guarded by adminPrefixGuard.
func (s *server) AdminGetPricingConfigSnapshot(w http.ResponseWriter, r *http.Request, id openapi_types.UUID) {
	if s.cfg.Store == nil {
		internalError(w, "store not configured")
		return
	}
	row, err := s.cfg.Store.GetPricingConfigSnapshotByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			apiError(w, http.StatusNotFound, PricingConfigInvalid, "pricing config snapshot not found", nil)
			return
		}
		s.cfg.Logger.Error("pricing-config: load snapshot failed", "id", id, "err", err)
		internalError(w, "failed to load pricing config snapshot")
		return
	}
	view, err := s.snapshotView(row.ID, row.Label, row.CreatedAt.Time, row.IsActive, row.Config)
	if err != nil {
		s.cfg.Logger.Error("pricing-config: snapshot does not decode", "id", id, "err", err)
		internalError(w, "pricing config snapshot does not decode")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

// AdminReplacePricingConfig validates and publishes a new active snapshot.
// Guarded by adminPrefixGuard. The swap is live: the next quote prices
// against the new config with no restart.
func (s *server) AdminReplacePricingConfig(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Store == nil || s.cfg.Pricing == nil {
		internalError(w, "store/pricing not configured")
		return
	}
	var req struct {
		Label  string          `json:"label"`
		Config json.RawMessage `json:"config"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Label == "" {
		badRequest(w, PricingConfigInvalid, "label is required", nil)
		return
	}
	cfg, err := pricing.DecodeStrict(bytes.NewReader(req.Config))
	if err != nil {
		badRequest(w, PricingConfigInvalid, err.Error(), nil)
		return
	}
	if err := pricing.Validate(cfg); err != nil {
		params := map[string]any{}
		var fe *pricing.FieldError
		if errors.As(err, &fe) {
			params["field"] = fe.Field
		}
		badRequest(w, PricingConfigInvalid, err.Error(), params)
		return
	}
	canonical, err := json.Marshal(cfg)
	if err != nil {
		internalError(w, "failed to encode pricing config")
		return
	}

	pricingSwapMu.Lock()
	defer pricingSwapMu.Unlock()
	id, err := s.cfg.Store.ReplaceActivePricingConfig(r.Context(), req.Label, canonical)
	if err != nil {
		s.cfg.Logger.Error("pricing-config: persist failed", "err", err)
		internalError(w, "failed to persist pricing config")
		return
	}
	s.cfg.Pricing.Set(id, cfg)
	s.cfg.Logger.Info("pricing config published", "id", id, "label", req.Label)
	writeJSON(w, http.StatusOK, ReplacePricingConfigResponse{Id: id})
}
