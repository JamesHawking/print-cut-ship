package httpapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/leadtime"
	"github.com/JamesHawking/print-cut-ship/backend/internal/makerworld"
	"github.com/JamesHawking/print-cut-ship/backend/internal/money"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
	"github.com/JamesHawking/print-cut-ship/backend/internal/storage"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// errQuoteFileInvalid marks a client-supplied part.fileId that doesn't resolve
// to a stored file with a matching hash — a 400, not a 500.
var errQuoteFileInvalid = errors.New("referenced file not found or hash mismatch")

var priceCfg = &pricing.Default

// ------------------------------------------------------------------ helpers

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// apiError writes the localization-contract error envelope: a machine code
// (+ structured params) the frontend dictionary maps to copy, plus English
// debug prose that is never displayed (Plans/08-i18n.md).
func apiError(w http.ResponseWriter, status int, code ApiErrorCode, msg string, params map[string]any) {
	e := ApiError{Code: code, Error: msg}
	if len(params) > 0 {
		e.Params = &params
	}
	writeJSON(w, status, e)
}

func badRequest(w http.ResponseWriter, code ApiErrorCode, msg string, params map[string]any) {
	apiError(w, http.StatusBadRequest, code, msg, params)
}

func internalError(w http.ResponseWriter, msg string) {
	apiError(w, http.StatusInternalServerError, Internal, msg, nil)
}

func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		badRequest(w, InvalidBody, "invalid JSON body", nil)
		return false
	}
	return true
}

// makeID mirrors the TS makeId: prefix + 8 uppercase hex chars.
func makeID(prefix string) string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return prefix + "-" + strings.ToUpper(hex.EncodeToString(b))
}

func validEmail(s string) bool {
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s
}

var euCountries = map[EuCountry]bool{
	"PL": true, "DE": true, "FR": true, "NL": true, "BE": true, "CZ": true,
	"AT": true, "IT": true, "ES": true, "SE": true, "DK": true, "FI": true,
	"IE": true, "PT": true, "SK": true, "SI": true, "HU": true, "RO": true,
	"LT": true, "LV": true, "EE": true, "LU": true, "BG": true, "HR": true,
	"GR": true,
}

// encodeURIComponent replicates the JS function for header values (QueryEscape
// alone would turn spaces into '+', which decodeURIComponent won't undo).
func encodeURIComponent(s string) string {
	return strings.ReplaceAll(url.QueryEscape(s), "+", "%20")
}

// ------------------------------------------------------- domain conversions

func toDomainMetrics(m MeshMetrics) pricing.MeshMetrics {
	out := pricing.MeshMetrics{
		VolumeCm3:        m.VolumeCm3,
		SurfaceAreaCm2:   m.SurfaceAreaCm2,
		BboxMm:           pricing.Vec3(m.BboxMm),
		UsedHullFallback: m.UsedHullFallback,
	}
	if m.Pieces != nil {
		for _, p := range *m.Pieces {
			out.Pieces = append(out.Pieces, pricing.Piece{BboxMm: pricing.Vec3(p.BboxMm)})
		}
	}
	return out
}

func fromDomainQuote(q pricing.PartQuote) PartQuote {
	out := PartQuote{
		Blocked:            q.Blocked,
		BillableVolumeCm3:  q.BillableVolumeCm3,
		WeightG:            q.WeightG,
		PrintHours:         q.PrintHours,
		UnitBasePln:        q.UnitBasePln,
		DiscountFraction:   q.DiscountFraction,
		LeadTimeMultiplier: q.LeadTimeMultiplier,
		UnitPricePln:       q.UnitPricePln,
		LineTotalPln:       q.LineTotalPln,
		Breakdown:          make([]BreakdownLine, 0, len(q.Breakdown)),
		DfmFlags:           make([]DfmFlag, 0, len(q.DfmFlags)),
		PriceBreaks:        make([]PriceBreak, 0, len(q.PriceBreaks)),
		PieceCount:         q.PieceCount,
		Plates:             q.Plates,
	}
	for _, l := range q.Breakdown {
		label := l.Label
		line := BreakdownLine{
			Key: BreakdownLineKey(l.Key), Label: &label, AmountPln: l.AmountPln,
		}
		if l.Count > 0 {
			count := l.Count
			line.Count = &count
		}
		out.Breakdown = append(out.Breakdown, line)
	}
	for _, f := range q.DfmFlags {
		msg := f.Message
		gen := DfmFlag{
			Code:     DfmFlagCode(f.Code),
			Severity: DfmFlagSeverity(f.Severity),
			Message:  &msg,
		}
		if len(f.Params) > 0 {
			params := f.Params
			gen.Params = &params
		}
		if len(f.SuggestedProcesses) > 0 {
			ids := make([]ProcessId, 0, len(f.SuggestedProcesses))
			for _, id := range f.SuggestedProcesses {
				ids = append(ids, ProcessId(id))
			}
			gen.SuggestedProcesses = &ids
		}
		out.DfmFlags = append(out.DfmFlags, gen)
	}
	for _, b := range q.PriceBreaks {
		out.PriceBreaks = append(out.PriceBreaks, PriceBreak{
			Quantity:         int(b.Quantity),
			UnitPricePln:     b.UnitPricePln,
			DiscountFraction: b.DiscountFraction,
		})
	}
	return out
}

func fromDomainTotals(t pricing.OrderTotals) OrderTotals {
	return OrderTotals{
		PartsSubtotalPln: t.PartsSubtotalPln,
		MinOrderTopUpPln: t.MinOrderTopUpPln,
		OrderFeePln:      t.OrderFeePln,
		ShippingPln:      t.ShippingPln,
		NetTotalPln:      t.NetTotalPln,
		VatPln:           t.VatPln,
		GrossTotalPln:    t.GrossTotalPln,
		FreeShipping:     t.FreeShipping,
		MinOrderApplied:  t.MinOrderApplied,
	}
}

// validationError carries the code+params envelope for a rejected field;
// nil means valid.
type validationError struct {
	code   ApiErrorCode
	msg    string
	params map[string]any
}

// validatePart checks the shared metrics/config fields of price and quote
// submissions, mirroring the original Zod schemas.
func validatePart(metrics MeshMetrics, process ProcessId, quantity int, lead LeadTimeId) *validationError {
	if _, ok := priceCfg.Process(string(process)); !ok {
		return &validationError{UnknownProcess,
			fmt.Sprintf("unknown process %q", process),
			map[string]any{"process": string(process)}}
	}
	if _, ok := priceCfg.LeadTime(string(lead)); !ok {
		return &validationError{UnknownLeadTime,
			fmt.Sprintf("unknown leadTime %q", lead),
			map[string]any{"leadTime": string(lead)}}
	}
	if quantity < 1 || quantity > pricing.MaxQuantity {
		return &validationError{QuantityRange,
			fmt.Sprintf("quantity must be 1-%d", pricing.MaxQuantity),
			map[string]any{"max": pricing.MaxQuantity}}
	}
	if metrics.VolumeCm3 < 0 || metrics.SurfaceAreaCm2 < 0 {
		return &validationError{InvalidMetrics, "metrics must be non-negative", nil}
	}
	return nil
}

func priceParts(parts []SubmitQuotePart) ([]pricing.PartQuote, pricing.OrderTotals) {
	quotes := make([]pricing.PartQuote, 0, len(parts))
	for _, p := range parts {
		quotes = append(quotes, priceCfg.ComputePartQuote(toDomainMetrics(p.Metrics), pricing.PartConfig{
			Process:  string(p.Process),
			Quantity: float64(p.Quantity),
			LeadTime: string(p.LeadTime),
		}))
	}
	return quotes, priceCfg.ComputeOrderTotals(quotes)
}

// ----------------------------------------------------------------- handlers

func (s *server) Price(w http.ResponseWriter, r *http.Request) {
	var req PriceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Parts) < 1 || len(req.Parts) > pricing.MaxParts {
		badRequest(w, PartsCount,
			fmt.Sprintf("parts must contain 1-%d items", pricing.MaxParts),
			map[string]any{"max": pricing.MaxParts})
		return
	}
	quotes := make([]PartQuote, 0, len(req.Parts))
	domainQuotes := make([]pricing.PartQuote, 0, len(req.Parts))
	for _, p := range req.Parts {
		if v := validatePart(p.Metrics, p.Process, p.Quantity, p.LeadTime); v != nil {
			badRequest(w, v.code, v.msg, v.params)
			return
		}
		q := priceCfg.ComputePartQuote(toDomainMetrics(p.Metrics), pricing.PartConfig{
			Process:  string(p.Process),
			Quantity: float64(p.Quantity),
			LeadTime: string(p.LeadTime),
		})
		domainQuotes = append(domainQuotes, q)
		quotes = append(quotes, fromDomainQuote(q))
	}
	writeJSON(w, http.StatusOK, PriceResponse{
		Parts:  quotes,
		Totals: fromDomainTotals(priceCfg.ComputeOrderTotals(domainQuotes)),
	})
}

func (s *server) GetConfig(w http.ResponseWriter, _ *http.Request) {
	processes := make([]CatalogProcess, 0, len(priceCfg.Processes))
	for _, p := range priceCfg.Processes {
		processes = append(processes, CatalogProcess{
			Id:          ProcessId(p.ID),
			Label:       p.Label,
			DensityGCm3: p.DensityGCm3,
			PlnPerKg:    p.PlnPerKg,
			Factor:      p.Factor,
			PlnPerHour:  p.PlnPerHour,
			Build:       Vec3Mm{X: p.Build.X, Y: p.Build.Y, Z: p.Build.Z},
		})
	}
	leadTimes := make([]CatalogLeadTime, 0, len(priceCfg.LeadTimes))
	for _, lt := range priceCfg.LeadTimes {
		leadTimes = append(leadTimes, CatalogLeadTime{
			Id: LeadTimeId(lt.ID), Mult: lt.Mult, BusinessDays: lt.BusinessDays,
		})
	}
	tiers := make([]DiscountTier, 0, len(priceCfg.DiscountTiers))
	for _, dt := range priceCfg.DiscountTiers {
		tiers = append(tiers, DiscountTier{Quantity: int(dt.Quantity), Fraction: dt.Fraction})
	}
	writeJSON(w, http.StatusOK, CatalogResponse{
		Processes:     processes,
		LeadTimes:     leadTimes,
		DiscountTiers: tiers,
		Fdm: FdmModel{
			InfillFraction:          priceCfg.Fdm.InfillFraction,
			ShellThicknessMm:        priceCfg.Fdm.ShellThicknessMm,
			ShellGramsPerPrintHour:  priceCfg.Fdm.ShellGramsPerPrintHour,
			InfillGramsPerPrintHour: priceCfg.Fdm.InfillGramsPerPrintHour,
		},
		QuantityChips:            pricing.QuantityChips,
		MaxParts:                 pricing.MaxParts,
		MinOrderPln:              priceCfg.MinOrderPln,
		MinPartPricePln:          priceCfg.MinPartPricePln,
		OrderFeePln:              priceCfg.OrderFeePln,
		ShippingFlatPln:          priceCfg.ShippingFlatPln,
		FreeShippingThresholdPln: priceCfg.FreeShippingThresholdPln,
		VatRate:                  priceCfg.VatRate,
		ExtraPlateFeePln:         priceCfg.ExtraPlateFeePln,
	})
}

func (s *server) GetShipDates(w http.ResponseWriter, _ *http.Request) {
	now := time.Now()
	dates := make([]ShipDate, 0, len(priceCfg.LeadTimes))
	for _, lt := range priceCfg.LeadTimes {
		sd := leadtime.ComputeShipDate(lt.BusinessDays, priceCfg.SameDayCutoffHour, now)
		dates = append(dates, ShipDate{
			LeadTime:            LeadTimeId(lt.ID),
			Date:                CalDate{Y: sd.Date.Y, M: sd.Date.M, D: sd.Date.D},
			DispatchStartsToday: sd.DispatchStartsToday,
			Label:               sd.Label,
		})
	}
	writeJSON(w, http.StatusOK, ShipDatesResponse{ShipDates: dates})
}

func (s *server) SubmitQuote(w http.ResponseWriter, r *http.Request) {
	var req SubmitQuoteRequest
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
	if len(req.Parts) < 1 || len(req.Parts) > pricing.MaxParts {
		badRequest(w, PartsCount,
			fmt.Sprintf("parts must contain 1-%d items", pricing.MaxParts),
			map[string]any{"max": pricing.MaxParts})
		return
	}
	for _, p := range req.Parts {
		if p.FileName == "" || p.Hash == "" {
			badRequest(w, MissingFileFields, "fileName and hash are required", nil)
			return
		}
		if v := validatePart(p.Metrics, p.Process, p.Quantity, p.LeadTime); v != nil {
			badRequest(w, v.code, v.msg, v.params)
			return
		}
	}

	// Re-parse each part's stored file and recompute its geometry in Go, so
	// pricing consumes metrics derived from bytes the server holds — not
	// client-submitted ones. Soft-falls-back on storage/parse trouble; hard
	// 400s only on a stored-bytes hash mismatch (tampering/corruption).
	if s.cfg.Store != nil && s.cfg.Storage != nil {
		if err := s.recomputeQuoteParts(r.Context(), req.Parts); err != nil {
			if errors.Is(err, errQuoteFileInvalid) {
				badRequest(w, QuoteFileInvalid, err.Error(), nil)
				return
			}
			s.cfg.Logger.Error("recompute quote parts failed", "err", err)
			internalError(w, "failed to verify quote files")
			return
		}
	}

	// The server's own pricing is authoritative; the client total is only
	// telemetry for catching drift between the UI and this engine.
	partQuotes, totals := priceParts(req.Parts)
	quoteID := makeID("Q")
	logAttrs := []any{
		"quoteId", quoteID,
		"email", string(req.Email),
		"country", string(req.Country),
		"parts", len(req.Parts),
		"grossTotalPln", totals.GrossTotalPln,
	}
	if req.ClientGrossTotalPln != nil && *req.ClientGrossTotalPln != totals.GrossTotalPln {
		s.cfg.Logger.Warn("quote price mismatch (client vs server)",
			append(logAttrs, "clientGrossTotalPln", *req.ClientGrossTotalPln)...)
	}
	s.cfg.Logger.Info("submitQuote", logAttrs...)

	if s.cfg.Store != nil {
		if err := s.persistQuote(r.Context(), req, quoteID, partQuotes, totals); err != nil {
			if errors.Is(err, errQuoteFileInvalid) {
				badRequest(w, QuoteFileInvalid, err.Error(), nil)
				return
			}
			s.cfg.Logger.Error("persist quote failed", "quoteId", quoteID, "err", err)
			internalError(w, "failed to persist quote")
			return
		}
	} else {
		s.cfg.Logger.Warn("store not configured; quote not persisted", "quoteId", quoteID)
	}

	writeJSON(w, http.StatusOK, SubmitQuoteResponse{
		QuoteId: quoteID,
		Totals:  fromDomainTotals(totals),
	})
}

// ListOrders returns the order history (persisted quotes) for an email,
// newest first. Prototype access control: the frontend gates this behind a
// simulated one-time code, so there is no server-side identity check yet —
// plan 05 replaces this with real auth.
func (s *server) ListOrders(w http.ResponseWriter, r *http.Request, params ListOrdersParams) {
	email := string(params.Email)
	if !validEmail(email) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	orders := []OrderSummary{}
	if s.cfg.Store == nil {
		s.cfg.Logger.Warn("store not configured; returning empty order list")
		writeJSON(w, http.StatusOK, ListOrdersResponse{Orders: orders})
		return
	}
	rows, err := s.cfg.Store.ListQuotesByEmail(r.Context(), &email)
	if err != nil {
		s.cfg.Logger.Error("list orders failed", "err", err)
		internalError(w, "failed to list orders")
		return
	}
	for _, q := range rows {
		orders = append(orders, OrderSummary{
			QuoteId:       q.ShortID,
			CreatedAt:     q.CreatedAt.Time,
			Status:        OrderSummaryStatus(q.Status),
			GrossTotalPln: money.FromGrosze(q.GrossTotalGrosze),
			PartCount:     int(q.PartCount),
			FileName:      q.FirstFileName,
			LeadTime:      LeadTimeId(q.FirstLeadTime),
		})
	}
	writeJSON(w, http.StatusOK, ListOrdersResponse{Orders: orders})
}

// persistQuote writes the server-authored quote and its parts. Money is stored
// as integer grosze; breakdown/dfmFlags are serialized to jsonb. The quote is
// attached to the startup-verified pricing-config snapshot (cfg.PricingConfigID,
// guaranteed by cmd/api to match the pricing.Default that priced it) so later
// rate changes never reprice it.
func (s *server) persistQuote(ctx context.Context, req SubmitQuoteRequest, quoteID string, partQuotes []pricing.PartQuote, totals pricing.OrderTotals) error {
	var convErr error
	grosze := func(pln float64) int32 {
		v, err := money.ToGrosze(pln)
		if err != nil && convErr == nil {
			convErr = err
		}
		return v
	}
	email := string(req.Email)
	country := string(req.Country)
	// UI locale at submit time — plan 06 renders this quote's emails from it,
	// plan 05 seeds orders.locale. Absent on old clients → PL market default.
	locale := "pl"
	if req.Locale != nil {
		locale = string(*req.Locale)
	}
	quoteParams := store.InsertQuoteParams{
		ShortID:             quoteID,
		Email:               &email,
		Country:             &country,
		Locale:              locale,
		PricingConfigID:     s.cfg.PricingConfigID,
		PartsSubtotalGrosze: grosze(totals.PartsSubtotalPln),
		MinOrderTopupGrosze: grosze(totals.MinOrderTopUpPln),
		OrderFeeGrosze:      grosze(totals.OrderFeePln),
		ShippingGrosze:      grosze(totals.ShippingPln),
		NetTotalGrosze:      grosze(totals.NetTotalPln),
		VatGrosze:           grosze(totals.VatPln),
		GrossTotalGrosze:    grosze(totals.GrossTotalPln),
		FreeShipping:        totals.FreeShipping,
		MinOrderApplied:     totals.MinOrderApplied,
	}
	parts := make([]store.InsertQuotePartParams, 0, len(req.Parts))
	for i, p := range req.Parts {
		q := partQuotes[i]
		breakdown, err := json.Marshal(q.Breakdown)
		if err != nil {
			return fmt.Errorf("marshal breakdown: %w", err)
		}
		dfm, err := json.Marshal(q.DfmFlags)
		if err != nil {
			return fmt.Errorf("marshal dfmFlags: %w", err)
		}
		billable := q.BillableVolumeCm3
		part := store.InsertQuotePartParams{
			FileName:          p.FileName,
			Hash:              p.Hash,
			Process:           string(p.Process),
			Quantity:          int32(p.Quantity), // safe: validatePart caps at MaxQuantity
			LeadTime:          string(p.LeadTime),
			UnitPriceGrosze:   grosze(q.UnitPricePln),
			LineTotalGrosze:   grosze(q.LineTotalPln),
			BillableVolumeCm3: &billable,
			Breakdown:         breakdown,
			DfmFlags:          dfm,
		}
		if q.PieceCount != nil {
			pc := int32(*q.PieceCount)
			part.PieceCount = &pc
		}
		if q.Plates != nil {
			pl := int32(*q.Plates)
			part.Plates = &pl
		}
		// Link the stored file backing this part, verifying it exists with a
		// matching hash (the quoted geometry is the file the server holds).
		if p.FileId != nil {
			f, err := s.cfg.Store.GetFileByID(ctx, *p.FileId)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return fmt.Errorf("%w: %s", errQuoteFileInvalid, *p.FileId)
				}
				return fmt.Errorf("lookup file %s: %w", *p.FileId, err)
			}
			if f.Hash == nil || *f.Hash != p.Hash {
				return fmt.Errorf("%w: %s", errQuoteFileInvalid, *p.FileId)
			}
			part.FileID = p.FileId
		}
		parts = append(parts, part)
	}
	if convErr != nil {
		return fmt.Errorf("quote exceeds representable money: %w", convErr)
	}
	_, err := s.cfg.Store.CreateQuote(ctx, quoteParams, parts)
	return err
}

func (s *server) SubmitStepQuote(w http.ResponseWriter, r *http.Request) {
	var req StepQuoteRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !validEmail(string(req.Email)) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	if req.FileName == "" {
		badRequest(w, MissingFileName, "fileName is required", nil)
		return
	}
	if req.FileSize < 0 {
		badRequest(w, InvalidFileSize, "fileSize must be non-negative", nil)
		return
	}
	requestID := makeID("STEP")
	s.cfg.Logger.Info("requestStepQuote",
		"requestId", requestID, "email", string(req.Email), "fileName", req.FileName)

	if s.cfg.Store != nil {
		if _, err := s.cfg.Store.InsertStepRequest(r.Context(), store.InsertStepRequestParams{
			ShortID:       requestID,
			Email:         string(req.Email),
			FileName:      req.FileName,
			FileSizeBytes: int64(req.FileSize),
		}); err != nil {
			s.cfg.Logger.Error("persist step request failed", "requestId", requestID, "err", err)
			internalError(w, "failed to persist step request")
			return
		}
	} else {
		s.cfg.Logger.Warn("store not configured; step request not persisted", "requestId", requestID)
	}

	writeJSON(w, http.StatusOK, StepQuoteResponse{RequestId: requestID})
}

var makerworldStatus = map[makerworld.ErrorCode]int{
	makerworld.ErrTokenMissing:   http.StatusServiceUnavailable,
	makerworld.ErrDesignNotFound: http.StatusNotFound,
	makerworld.ErrNoInstance:     http.StatusNotFound,
	makerworld.ErrAuthExpired:    http.StatusUnauthorized,
	makerworld.ErrTooLarge:       http.StatusRequestEntityTooLarge,
	makerworld.ErrDownloadFailed: http.StatusBadGateway,
}

func (s *server) FetchMakerworldModel(w http.ResponseWriter, r *http.Request) {
	var req MakerworldFetchRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.DesignId < 1 {
		badRequest(w, InvalidDesignId, "designId must be positive", nil)
		return
	}
	if req.ProfileId != nil && *req.ProfileId < 1 {
		badRequest(w, InvalidProfileId, "profileId must be positive", nil)
		return
	}
	if s.cfg.BambuCloudToken == "" {
		writeJSON(w, makerworldStatus[makerworld.ErrTokenMissing],
			MakerworldError{Code: MakerworldErrorCode(makerworld.ErrTokenMissing)})
		return
	}
	ref := makerworld.Ref{DesignID: req.DesignId}
	if req.ProfileId != nil {
		ref.ProfileID = *req.ProfileId
	}
	res, code := makerworld.Download(ref, s.cfg.BambuCloudToken, s.makerworldClient)
	if code != "" {
		s.cfg.Logger.Info("makerworld fetch failed", "designId", req.DesignId, "code", string(code))
		writeJSON(w, makerworldStatus[code], MakerworldError{Code: MakerworldErrorCode(code)})
		return
	}
	s.cfg.Logger.Info("makerworld fetched",
		"designId", req.DesignId, "fileName", res.FileName, "bytes", len(res.Bytes))

	// Tee the bytes into storage so a later browser upload dedups onto this row
	// instead of re-PUTting 100 MB. Best-effort: a tee failure never fails the
	// fetch — the browser's own upload path is the fallback.
	s.teeMakerworldFile(r.Context(), req, res)

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Mw-Filename", encodeURIComponent(res.FileName))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(res.Bytes)
}

// teeMakerworldFile stores a downloaded MakerWorld 3MF (source='makerworld')
// unless an identical file is already stored. Non-fatal on any error.
func (s *server) teeMakerworldFile(ctx context.Context, req MakerworldFetchRequest, res *makerworld.Result) {
	if s.cfg.Store == nil || s.cfg.Storage == nil {
		return
	}
	sum := sha256.Sum256(res.Bytes)
	sha := hex.EncodeToString(sum[:])

	if _, err := s.cfg.Store.GetUploadedFileBySha256(ctx, &sha); err == nil {
		return // already stored
	} else if !errors.Is(err, pgx.ErrNoRows) {
		s.cfg.Logger.Warn("makerworld tee: dedup lookup failed", "err", err)
		return
	}

	key := storage.Key(sha, "3mf")
	if err := s.cfg.Storage.Put(ctx, key, bytes.NewReader(res.Bytes), int64(len(res.Bytes)), "model/3mf"); err != nil {
		s.cfg.Logger.Warn("makerworld tee: put failed", "err", err)
		return
	}
	sourceRef, _ := json.Marshal(req)
	if _, err := s.cfg.Store.InsertFile(ctx, store.InsertFileParams{
		FileName:      res.FileName,
		FileSizeBytes: int64(len(res.Bytes)),
		Kind:          "3mf",
		Hash:          &sha,
		Source:        "makerworld",
		SourceRef:     sourceRef,
		StorageKey:    &key,
	}); err != nil {
		s.cfg.Logger.Warn("makerworld tee: insert row failed", "err", err)
	}
}
