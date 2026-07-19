package httpapi

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/pricing"
)

func testHandler(t *testing.T, cfg Config, mwClient *http.Client) http.Handler {
	t.Helper()
	if cfg.Logger == nil {
		cfg.Logger = slog.New(slog.DiscardHandler)
	}
	s := &server{cfg: cfg, makerworldClient: mwClient}
	r := chi.NewRouter()
	r.Use(s.sessionMiddleware)
	return s.routes(r)
}

func doJSON(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

const validPart = `{
	"metrics": {"volumeCm3": 100, "surfaceAreaCm2": 130,
	            "bboxMm": {"x": 60, "y": 50, "z": 40}, "usedHullFallback": false},
	"process": "pla", "quantity": 2, "leadTime": "standard"
}`

func TestPriceEndpoint(t *testing.T) {
	h := testHandler(t, Config{}, nil)

	t.Run("happy path matches the engine", func(t *testing.T) {
		rec := doJSON(t, h, http.MethodPost, "/api/v1/price",
			fmt.Sprintf(`{"parts": [%s]}`, validPart))
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d: %s", rec.Code, rec.Body)
		}
		var res PriceResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		want := pricing.Default.ComputePartQuote(
			pricing.MeshMetrics{VolumeCm3: 100, SurfaceAreaCm2: 130,
				BboxMm: pricing.Vec3{X: 60, Y: 50, Z: 40}},
			pricing.PartConfig{Process: "pla", Quantity: 2, LeadTime: "standard"},
		)
		if len(res.Parts) != 1 {
			t.Fatalf("parts len %d", len(res.Parts))
		}
		if res.Parts[0].UnitPricePln != want.UnitPricePln ||
			res.Parts[0].LineTotalPln != want.LineTotalPln {
			t.Errorf("got %v/%v, want %v/%v", res.Parts[0].UnitPricePln,
				res.Parts[0].LineTotalPln, want.UnitPricePln, want.LineTotalPln)
		}
		wantTotals := pricing.Default.ComputeOrderTotals([]pricing.PartQuote{want})
		if res.Totals.GrossTotalPln != wantTotals.GrossTotalPln {
			t.Errorf("gross %v, want %v", res.Totals.GrossTotalPln, wantTotals.GrossTotalPln)
		}
	})

	badBodies := map[string]string{
		"empty parts":      `{"parts": []}`,
		"too many parts":   fmt.Sprintf(`{"parts": [%s,%s,%s,%s,%s,%s]}`, validPart, validPart, validPart, validPart, validPart, validPart),
		"unknown process":  strings.Replace(fmt.Sprintf(`{"parts": [%s]}`, validPart), `"pla"`, `"resin"`, 1),
		"unknown leadTime": strings.Replace(fmt.Sprintf(`{"parts": [%s]}`, validPart), `"standard"`, `"warp"`, 1),
		"zero quantity":    strings.Replace(fmt.Sprintf(`{"parts": [%s]}`, validPart), `"quantity": 2`, `"quantity": 0`, 1),
		"huge quantity":    strings.Replace(fmt.Sprintf(`{"parts": [%s]}`, validPart), `"quantity": 2`, `"quantity": 15000000`, 1),
		"negative volume":  strings.Replace(fmt.Sprintf(`{"parts": [%s]}`, validPart), `"volumeCm3": 100`, `"volumeCm3": -1`, 1),
		"not JSON":         `{`,
	}
	for name, body := range badBodies {
		t.Run("400 on "+name, func(t *testing.T) {
			if rec := doJSON(t, h, http.MethodPost, "/api/v1/price", body); rec.Code != http.StatusBadRequest {
				t.Errorf("status %d, want 400", rec.Code)
			}
		})
	}
}

func TestConfigEndpoint(t *testing.T) {
	h := testHandler(t, Config{}, nil)
	rec := doJSON(t, h, http.MethodGet, "/api/v1/config", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var res CatalogResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Processes) != 7 || res.Processes[0].Id != "pla" || res.Processes[0].Label != "PLA" {
		t.Errorf("processes: %+v", res.Processes)
	}
	if len(res.LeadTimes) != 3 || res.MinOrderPln != 30 || res.VatRate != 0.23 || res.MaxParts != 5 {
		t.Errorf("catalog constants off: %+v", res)
	}
}

func TestShipDatesEndpoint(t *testing.T) {
	h := testHandler(t, Config{}, nil)
	rec := doJSON(t, h, http.MethodGet, "/api/v1/ship-dates", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var res ShipDatesResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.ShipDates) != 3 {
		t.Fatalf("want 3 ship dates, got %d", len(res.ShipDates))
	}
	labelRe := regexp.MustCompile(`^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]+$`)
	for _, sd := range res.ShipDates {
		if !labelRe.MatchString(sd.Label) {
			t.Errorf("label %q doesn't match expected format", sd.Label)
		}
	}
}

func TestSubmitQuoteEndpoint(t *testing.T) {
	h := testHandler(t, Config{}, nil)
	quotePart := strings.Replace(validPart, `"metrics"`, `"fileName": "part.stl", "hash": "abc123", "metrics"`, 1)

	t.Run("happy path returns id and server totals", func(t *testing.T) {
		body := fmt.Sprintf(`{"email": "jan@example.com", "country": "PL", "parts": [%s]}`, quotePart)
		rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", body)
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d: %s", rec.Code, rec.Body)
		}
		var res SubmitQuoteResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		if !regexp.MustCompile(`^Q-[0-9A-F]{8}$`).MatchString(res.QuoteId) {
			t.Errorf("quoteId %q", res.QuoteId)
		}
		if res.Totals.GrossTotalPln <= 0 {
			t.Errorf("totals not computed: %+v", res.Totals)
		}
	})

	t.Run("price mismatch is accepted (telemetry only)", func(t *testing.T) {
		body := fmt.Sprintf(`{"email": "jan@example.com", "country": "DE", "parts": [%s], "clientGrossTotalPln": 1.23}`, quotePart)
		if rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", body); rec.Code != http.StatusOK {
			t.Errorf("status %d, want 200", rec.Code)
		}
	})

	// Each rejection carries a stable machine code + params — the frontend
	// dictionary owns the human copy (plans/engineering/08-i18n.md localization contract).
	bad := map[string]struct {
		body string
		code ApiErrorCode
	}{
		// The generated Email type runs mail.ParseAddress at decode time, so a
		// bad email in a JSON body surfaces as invalid_body; the handler's own
		// invalid_email fires on query-param binding (see TestListOrders400).
		"invalid email": {fmt.Sprintf(`{"email": "nope", "country": "PL", "parts": [%s]}`, quotePart), InvalidBody},
		"invalid country": {fmt.Sprintf(`{"email": "jan@example.com", "country": "US", "parts": [%s]}`, quotePart),
			UnsupportedCountry},
		"empty parts": {`{"email": "jan@example.com", "country": "PL", "parts": []}`, PartsCount},
		"missing hash": {fmt.Sprintf(`{"email": "jan@example.com", "country": "PL", "parts": [%s]}`,
			strings.Replace(quotePart, `"hash": "abc123"`, `"hash": ""`, 1)), MissingFileFields},
	}
	for name, tc := range bad {
		t.Run("400 on "+name, func(t *testing.T) {
			rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes", tc.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status %d, want 400", rec.Code)
			}
			var e ApiError
			if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil {
				t.Fatal(err)
			}
			if e.Code != tc.code {
				t.Errorf("code %q, want %q", e.Code, tc.code)
			}
			if e.Error == "" {
				t.Error("debug prose missing")
			}
		})
	}

	t.Run("orders requires a session", func(t *testing.T) {
		rec := doJSON(t, h, http.MethodGet, "/api/v1/orders", "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
		var e ApiError
		if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil {
			t.Fatal(err)
		}
		if e.Code != Unauthorized {
			t.Errorf("code %q, want %q", e.Code, Unauthorized)
		}
	})

	t.Run("parts_count carries the max param", func(t *testing.T) {
		rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes",
			`{"email": "jan@example.com", "country": "PL", "parts": []}`)
		var e ApiError
		if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil {
			t.Fatal(err)
		}
		if e.Params == nil || (*e.Params)["max"] != float64(5) {
			t.Errorf("params = %v, want max=5", e.Params)
		}
	})
}

func TestStepQuoteEndpoint(t *testing.T) {
	h := testHandler(t, Config{}, nil)
	t.Run("happy path", func(t *testing.T) {
		rec := doJSON(t, h, http.MethodPost, "/api/v1/step-quotes",
			`{"email": "jan@example.com", "fileName": "bracket.step", "fileSize": 12345}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d: %s", rec.Code, rec.Body)
		}
		var res StepQuoteResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		if !regexp.MustCompile(`^STEP-[0-9A-F]{8}$`).MatchString(res.RequestId) {
			t.Errorf("requestId %q", res.RequestId)
		}
	})
	t.Run("400 on invalid email", func(t *testing.T) {
		rec := doJSON(t, h, http.MethodPost, "/api/v1/step-quotes",
			`{"email": "nope", "fileName": "bracket.step", "fileSize": 1}`)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status %d, want 400", rec.Code)
		}
	})
}

func TestMakerworldEndpoint(t *testing.T) {
	t.Run("503 token_missing without token", func(t *testing.T) {
		h := testHandler(t, Config{}, nil)
		rec := doJSON(t, h, http.MethodPost, "/api/v1/makerworld/fetch", `{"designId": 696853}`)
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status %d, want 503", rec.Code)
		}
		var res MakerworldError
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		if res.Code != "token_missing" {
			t.Errorf("code %q", res.Code)
		}
	})

	t.Run("400 on non-positive designId", func(t *testing.T) {
		h := testHandler(t, Config{BambuCloudToken: "tok"}, nil)
		if rec := doJSON(t, h, http.MethodPost, "/api/v1/makerworld/fetch", `{"designId": 0}`); rec.Code != http.StatusBadRequest {
			t.Errorf("status %d, want 400", rec.Code)
		}
	})

	t.Run("proxies bytes with encoded filename header", func(t *testing.T) {
		stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case strings.Contains(r.URL.Path, "/design-service/design/"):
				fmt.Fprintf(w, `{"id":1,"title":"Świnka Model","modelId":"m-1","defaultInstanceId":11,"instances":[{"id":11,"profileId":101}]}`)
			case strings.Contains(r.URL.Path, "/iot-service/"):
				fmt.Fprintf(w, `{"url":"http://%s/file"}`, r.Host)
			case r.URL.Path == "/file":
				_, _ = w.Write([]byte("3mf-data"))
			default:
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		defer stub.Close()
		h := testHandler(t, Config{BambuCloudToken: "tok"}, &http.Client{
			Transport: hostRewriter{target: strings.TrimPrefix(stub.URL, "http://")},
		})
		rec := doJSON(t, h, http.MethodPost, "/api/v1/makerworld/fetch", `{"designId": 1}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d: %s", rec.Code, rec.Body)
		}
		if rec.Body.String() != "3mf-data" {
			t.Errorf("body %q", rec.Body)
		}
		if got := rec.Header().Get("X-Mw-Filename"); got != "%C5%9Awinka%20Model.3mf" {
			t.Errorf("filename header %q", got)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/octet-stream" {
			t.Errorf("content-type %q", ct)
		}
	})

	t.Run("maps not-found design to 404", func(t *testing.T) {
		stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			fmt.Fprint(w, `{}`)
		}))
		defer stub.Close()
		h := testHandler(t, Config{BambuCloudToken: "tok"}, &http.Client{
			Transport: hostRewriter{target: strings.TrimPrefix(stub.URL, "http://")},
		})
		rec := doJSON(t, h, http.MethodPost, "/api/v1/makerworld/fetch", `{"designId": 1}`)
		if rec.Code != http.StatusNotFound {
			t.Errorf("status %d, want 404", rec.Code)
		}
	})
}

// hostRewriter redirects api.bambulab.com to a local stub.
type hostRewriter struct{ target string }

func (h hostRewriter) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.URL.Host == "api.bambulab.com" {
		req.URL.Scheme = "http"
		req.URL.Host = h.target
	}
	return http.DefaultTransport.RoundTrip(req)
}
