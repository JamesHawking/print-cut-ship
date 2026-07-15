package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/JamesHawking/print-cut-ship/backend/internal/leadtime"
	"github.com/JamesHawking/print-cut-ship/backend/internal/makerworld"
	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
)

var priceCfg = &pricing.Default

// ------------------------------------------------------------------ helpers

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func badRequest(w http.ResponseWriter, msg string) {
	writeJSON(w, http.StatusBadRequest, ApiError{Error: msg})
}

func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		badRequest(w, "invalid JSON body")
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
		out.Breakdown = append(out.Breakdown, BreakdownLine{
			Key: BreakdownLineKey(l.Key), Label: l.Label, AmountPln: l.AmountPln,
		})
	}
	for _, f := range q.DfmFlags {
		gen := DfmFlag{
			Code:     DfmFlagCode(f.Code),
			Severity: DfmFlagSeverity(f.Severity),
			Message:  f.Message,
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

// validatePart checks the shared metrics/config fields of price and quote
// submissions, mirroring the original Zod schemas.
func validatePart(metrics MeshMetrics, process ProcessId, quantity int, lead LeadTimeId) string {
	if _, ok := priceCfg.Process(string(process)); !ok {
		return fmt.Sprintf("unknown process %q", process)
	}
	if _, ok := priceCfg.LeadTime(string(lead)); !ok {
		return fmt.Sprintf("unknown leadTime %q", lead)
	}
	if quantity < 1 {
		return "quantity must be >= 1"
	}
	if metrics.VolumeCm3 < 0 || metrics.SurfaceAreaCm2 < 0 {
		return "metrics must be non-negative"
	}
	return ""
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
		badRequest(w, fmt.Sprintf("parts must contain 1-%d items", pricing.MaxParts))
		return
	}
	quotes := make([]PartQuote, 0, len(req.Parts))
	domainQuotes := make([]pricing.PartQuote, 0, len(req.Parts))
	for _, p := range req.Parts {
		if msg := validatePart(p.Metrics, p.Process, p.Quantity, p.LeadTime); msg != "" {
			badRequest(w, msg)
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
		badRequest(w, "invalid email")
		return
	}
	if !euCountries[req.Country] {
		badRequest(w, fmt.Sprintf("unsupported country %q", req.Country))
		return
	}
	if len(req.Parts) < 1 || len(req.Parts) > pricing.MaxParts {
		badRequest(w, fmt.Sprintf("parts must contain 1-%d items", pricing.MaxParts))
		return
	}
	for _, p := range req.Parts {
		if p.FileName == "" || p.Hash == "" {
			badRequest(w, "fileName and hash are required")
			return
		}
		if msg := validatePart(p.Metrics, p.Process, p.Quantity, p.LeadTime); msg != "" {
			badRequest(w, msg)
			return
		}
	}

	// The server's own pricing is authoritative; the client total is only
	// telemetry for catching drift between the UI and this engine.
	_, totals := priceParts(req.Parts)
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

	writeJSON(w, http.StatusOK, SubmitQuoteResponse{
		QuoteId: quoteID,
		Totals:  fromDomainTotals(totals),
	})
}

func (s *server) SubmitStepQuote(w http.ResponseWriter, r *http.Request) {
	var req StepQuoteRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !validEmail(string(req.Email)) {
		badRequest(w, "invalid email")
		return
	}
	if req.FileName == "" {
		badRequest(w, "fileName is required")
		return
	}
	if req.FileSize < 0 {
		badRequest(w, "fileSize must be non-negative")
		return
	}
	requestID := makeID("STEP")
	s.cfg.Logger.Info("requestStepQuote",
		"requestId", requestID, "email", string(req.Email), "fileName", req.FileName)
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
		badRequest(w, "designId must be positive")
		return
	}
	if req.ProfileId != nil && *req.ProfileId < 1 {
		badRequest(w, "profileId must be positive")
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
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Mw-Filename", encodeURIComponent(res.FileName))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(res.Bytes)
}
