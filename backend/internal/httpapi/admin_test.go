package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// adminRoutes is the auth-sweep table for the fail-closed prefix guard
// (plan 07): every admin endpoint, grown each phase. Anon must 401, a
// customer session must 403, an admin session must get past the guard
// (whatever the handler then answers).
var adminRoutes = []struct {
	method string
	path   string
}{
	{http.MethodGet, "/api/v1/admin/orders"},
	{http.MethodGet, "/api/v1/admin/orders/O-DEADBEEF"},
	{http.MethodPost, "/api/v1/admin/orders/O-DEADBEEF/refund"},
	{http.MethodPost, "/api/v1/admin/orders/O-DEADBEEF/transition"},
	{http.MethodGet, "/api/v1/admin/orders/O-DEADBEEF/files/00000000-0000-0000-0000-000000000000"},
}

// makeAdmin promotes the email's user row and returns the session cookie.
func makeAdmin(t *testing.T, pool *pgxpool.Pool, session *http.Cookie, email string) *http.Cookie {
	t.Helper()
	if _, err := pool.Exec(context.Background(),
		`UPDATE users SET role = 'admin' WHERE email = $1`, email); err != nil {
		t.Fatal(err)
	}
	return session
}

func TestAdminAuthSweep(t *testing.T) {
	h, _, pool, mailer := setupOrdersTest(t)
	customer := requestCodeAndVerify(t, h, mailer, "customer@example.com")
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "boss@example.com"), "boss@example.com")

	for _, rt := range adminRoutes {
		name := rt.method + " " + rt.path
		rec := doJSON(t, h, rt.method, rt.path, "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s anon: %d, want 401", name, rec.Code)
		}
		rec = doJSONCookies(t, h, rt.method, rt.path, "", customer)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s customer: %d, want 403", name, rec.Code)
		}
		rec = doJSONCookies(t, h, rt.method, rt.path, "", admin)
		if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden {
			t.Fatalf("%s admin: %d, guard must let admins through", name, rec.Code)
		}
	}

	// Non-admin paths are untouched by the guard.
	if rec := doJSON(t, h, http.MethodGet, "/healthz", ""); rec.Code != http.StatusOK {
		t.Fatalf("healthz: %d, want 200", rec.Code)
	}
}

func TestMeResponseRole(t *testing.T) {
	h, _, pool, mailer := setupOrdersTest(t)

	customer := requestCodeAndVerify(t, h, mailer, "role-customer@example.com")
	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", customer)
	var me MeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me.Role != Customer {
		t.Fatalf("role %q, want customer", me.Role)
	}

	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "role-admin@example.com"), "role-admin@example.com")
	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", admin)
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me.Role != Admin {
		t.Fatalf("role %q, want admin", me.Role)
	}
}

func TestAdminListOrders(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "board@example.com"), "board@example.com")

	// Two orders for one customer (one paid), one draft for another.
	q1 := submitTestQuote(t, h, st, "jan@example.com")
	o1 := createTestOrder(t, h, q1, "jan@example.com", "")
	payTestOrder(t, h, o1.OrderId)
	q2 := submitTestQuote(t, h, st, "jan@example.com")
	createTestOrder(t, h, q2, "jan@example.com", "")
	q3 := submitTestQuote(t, h, st, "ala@example.com")
	createTestOrder(t, h, q3, "ala@example.com", "")

	get := func(path string) AdminListOrdersResponse {
		t.Helper()
		rec := doJSONCookies(t, h, http.MethodGet, path, "", admin)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s: %d: %s", path, rec.Code, rec.Body)
		}
		var res AdminListOrdersResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		return res
	}

	res := get("/api/v1/admin/orders")
	if res.Total != 3 || len(res.Orders) != 3 || res.Limit != 50 || res.Offset != 0 {
		t.Fatalf("board: total=%d len=%d limit=%d offset=%d", res.Total, len(res.Orders), res.Limit, res.Offset)
	}
	// The paid order carries ship-by + paidAt; drafts don't.
	var paid *AdminOrderSummary
	for i := range res.Orders {
		if res.Orders[i].OrderId == o1.OrderId {
			paid = &res.Orders[i]
		}
		if res.Orders[i].Status == Draft && res.Orders[i].ShipBy != nil {
			t.Fatalf("draft has shipBy: %+v", res.Orders[i])
		}
	}
	if paid == nil || paid.Status != Paid || paid.PaidAt == nil || paid.ShipBy == nil {
		t.Fatalf("paid order summary wrong: %+v", paid)
	}
	if paid.PartCount != 1 || paid.Email != "jan@example.com" || paid.GrossTotalPln <= 0 {
		t.Fatalf("paid order summary wrong: %+v", paid)
	}

	// Status filter.
	res = get("/api/v1/admin/orders?status=paid")
	if res.Total != 1 || len(res.Orders) != 1 || res.Orders[0].Status != Paid {
		t.Fatalf("paid filter: %+v", res)
	}

	// Pagination: 2 per page.
	res = get("/api/v1/admin/orders?limit=2&offset=2")
	if res.Total != 3 || len(res.Orders) != 1 || res.Limit != 2 || res.Offset != 2 {
		t.Fatalf("page 2: total=%d len=%d", res.Total, len(res.Orders))
	}
	// Limit clamps at 200.
	res = get("/api/v1/admin/orders?limit=9999")
	if res.Limit != 200 {
		t.Fatalf("limit clamp: %d, want 200", res.Limit)
	}
}

func TestAdminGetOrder(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "detail@example.com"), "detail@example.com")

	quoteID := submitTestQuote(t, h, st, "piotr@example.com")
	order := createTestOrder(t, h, quoteID, "piotr@example.com",
		`"companyName": "ACME sp. z o.o.", "nip": "8567346215", "invoiceRequested": true,`)
	payTestOrder(t, h, order.OrderId)

	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/orders/"+order.OrderId, "", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("detail status %d: %s", rec.Code, rec.Body)
	}
	var res AdminOrderDetail
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	o := res.Order
	if o.OrderId != order.OrderId || o.Email != "piotr@example.com" || o.Status != Paid {
		t.Fatalf("order wrong: %+v", o)
	}
	if o.Nip == nil || *o.Nip != "8567346215" || o.CompanyName == nil || !o.InvoiceRequested {
		t.Fatalf("b2b fields wrong: %+v", o)
	}
	if o.StatusToken != order.StatusToken || o.ShippingAddress.City != "Warszawa" ||
		o.Totals.GrossTotalPln <= 0 || o.PricingConfigId.String() == "" {
		t.Fatalf("order detail wrong: %+v", o)
	}
	if len(res.Items) != 1 || res.Items[0].FileName != "widget.stl" || res.Items[0].FileId == nil {
		t.Fatalf("items wrong: %+v", res.Items)
	}
	if res.Items[0].PartQuoteSnapshot == nil {
		t.Fatal("item missing partQuoteSnapshot")
	}
	if len(res.Payments) != 1 || res.Payments[0].Type != Payment ||
		res.Payments[0].Provider != "stub" {
		t.Fatalf("payments wrong: %+v", res.Payments)
	}
	if len(res.Invoices) != 0 {
		t.Fatalf("invoices %d, want 0 (seam only until plan 18)", len(res.Invoices))
	}

	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/orders/O-DEADBEEF", "", admin)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unknown order status %d, want 404", rec.Code)
	}
}

func TestAdminShipByDerivation(t *testing.T) {
	// Pinned clock: 2026-07-15 is a Wednesday (before the 14:00 cutoff), so a
	// paid order with standard (5 business days) lead time ships 2026-07-22.
	fixed := time.Date(2026, 7, 15, 10, 0, 0, 0, time.UTC)
	s := &server{cfg: Config{Now: func() time.Time { return fixed }}}

	ship := s.shipBy("paid", []string{"standard"}, timestamptz(fixed))
	if ship == nil || ship.ISO() != "2026-07-22" {
		t.Fatalf("shipBy %v, want 2026-07-22", ship)
	}
	if ship := s.shipBy("draft", []string{"standard"}, timestamptz(fixed)); ship != nil {
		t.Fatalf("draft shipBy %v, want nil", ship)
	}
	// Max over items wins: express (3) + economy (10) → economy's 10 days → 2026-07-29.
	ship = s.shipBy("paid", []string{"express", "economy"}, timestamptz(fixed))
	if ship == nil || ship.ISO() != "2026-07-29" {
		t.Fatalf("shipBy max %v, want 2026-07-29", ship)
	}
}

func TestAdminDfmFlagging(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "dfm@example.com"), "dfm@example.com")

	quoteID := submitTestQuote(t, h, st, "flagged@example.com")
	order := createTestOrder(t, h, quoteID, "flagged@example.com", "")
	// Inject warn + manual_verify flags into the item snapshot (plan 02's
	// real DFM codes are severity-driven; manual_verify is forward-compat).
	ctx := context.Background()
	o, _ := st.GetOrderByShortID(ctx, order.OrderId)
	if _, err := pool.Exec(ctx, `
		UPDATE order_items
		SET part_quote_snapshot = jsonb_set(part_quote_snapshot, '{dfmFlags}',
			'[{"code": "multi_plate", "severity": "warn"},
			  {"code": "manual_verify", "severity": "info"}]')
		WHERE order_id = $1`, o.ID); err != nil {
		t.Fatal(err)
	}

	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/orders", "", admin)
	var res AdminListOrdersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Orders) != 1 || !res.Orders[0].DfmFlagged || res.Orders[0].DfmCodes == nil {
		t.Fatalf("flagging wrong: %+v", res.Orders)
	}
	codes := *res.Orders[0].DfmCodes
	if fmt.Sprint(codes) != "[manual_verify multi_plate]" && fmt.Sprint(codes) != "[multi_plate manual_verify]" {
		t.Fatalf("dfm codes %v, want multi_plate + manual_verify", codes)
	}
}

func TestAdminTransitionWalk(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "transitions@example.com"), "transitions@example.com")

	quoteID := submitTestQuote(t, h, st, "walk@example.com")
	order := createTestOrder(t, h, quoteID, "walk@example.com", "")
	payTestOrder(t, h, order.OrderId)
	path := "/api/v1/admin/orders/" + order.OrderId + "/transition"

	transition := func(body string) *httptest.ResponseRecorder {
		t.Helper()
		return doJSONCookies(t, h, http.MethodPost, path, body, admin)
	}
	status := func() string {
		t.Helper()
		o, err := st.GetOrderByShortID(context.Background(), order.OrderId)
		if err != nil {
			t.Fatal(err)
		}
		return o.Status
	}

	// Shipped without tracking from in_production is tested below; first the
	// full happy walk paid → in_production → shipped → delivered.
	if rec := transition(`{"to": "in_production"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("start production: %d: %s", rec.Code, rec.Body)
	}
	if got := status(); got != "in_production" {
		t.Fatalf("status %q, want in_production", got)
	}

	// Shipped without a tracking number → 400 tracking_required.
	rec := transition(`{"to": "shipped"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("shipped w/o tracking: %d, want 400", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != TrackingRequired {
		t.Fatalf("code %q, want tracking_required", e.Code)
	}

	rec = transition(`{"to": "shipped", "trackingNumber": "DPD-123456"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("ship: %d: %s", rec.Code, rec.Body)
	}
	o, err := st.GetOrderByShortID(context.Background(), order.OrderId)
	if err != nil {
		t.Fatal(err)
	}
	if o.Status != "shipped" || o.TrackingNumber == nil || *o.TrackingNumber != "DPD-123456" {
		t.Fatalf("shipped state wrong: status=%q tracking=%v", o.Status, o.TrackingNumber)
	}

	if rec := transition(`{"to": "delivered"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("deliver: %d: %s", rec.Code, rec.Body)
	}
	if got := status(); got != "delivered" {
		t.Fatalf("status %q, want delivered", got)
	}

	// Terminal: any further transition → 409 order_wrong_state.
	rec = transition(`{"to": "cancelled"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("cancel from terminal: %d, want 409", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != OrderWrongState || e.Params == nil || (*e.Params)["from"] != "delivered" {
		t.Fatalf("conflict wrong: %+v", e)
	}
}

func TestAdminTransitionRejects(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "rejects@example.com"), "rejects@example.com")

	quoteID := submitTestQuote(t, h, st, "reject@example.com")
	order := createTestOrder(t, h, quoteID, "reject@example.com", "")
	payTestOrder(t, h, order.OrderId)
	path := "/api/v1/admin/orders/" + order.OrderId + "/transition"

	// refunded is never a board target — money moves only via the pipeline.
	rec := doJSONCookies(t, h, http.MethodPost, path, `{"to": "refunded"}`, admin)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("refunded target: %d, want 400", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != TransitionNotAllowed {
		t.Fatalf("code %q, want transition_not_allowed", e.Code)
	}
	// draft/paid are pipeline-owned targets too.
	for _, to := range []string{"draft", "paid"} {
		rec = doJSONCookies(t, h, http.MethodPost, path, fmt.Sprintf(`{"to": %q}`, to), admin)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s target: %d, want 400", to, rec.Code)
		}
	}

	// Illegal jump paid → delivered → 409 order_wrong_state.
	rec = doJSONCookies(t, h, http.MethodPost, path, `{"to": "delivered"}`, admin)
	if rec.Code != http.StatusConflict {
		t.Fatalf("paid→delivered: %d, want 409", rec.Code)
	}

	// Unknown order → 404.
	rec = doJSONCookies(t, h, http.MethodPost, "/api/v1/admin/orders/O-DEADBEEF/transition",
		`{"to": "in_production"}`, admin)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unknown order: %d, want 404", rec.Code)
	}

	// Cancel from paid is legal (state machine) and sticks.
	rec = doJSONCookies(t, h, http.MethodPost, path, `{"to": "cancelled"}`, admin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("cancel: %d: %s", rec.Code, rec.Body)
	}
	o, _ := st.GetOrderByShortID(context.Background(), order.OrderId)
	if o.Status != "cancelled" {
		t.Fatalf("status %q, want cancelled", o.Status)
	}
}

func TestAdminDownloadOrderFile(t *testing.T) {
	st, cfgID := setupTestStore(t)
	strg := setupTestStorage(t)
	pool, err := pgxpool.New(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE login_codes, sessions, payments, order_items, invoices RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	mailer := &captureMailer{}
	svc := auth.NewService(st, mailer, nil, 10*time.Minute, 30*24*time.Hour)
	pipeline := &payments.Pipeline{Store: st, Logger: slog.New(slog.DiscardHandler)}
	h := testHandler(t, Config{
		Store: st, Storage: strg, Auth: svc, Pricing: testHolder(cfgID),
		Payments: payments.NewStub("http://test.local", pipeline),
		Pipeline: pipeline, PublicBaseURL: "http://test.local",
	}, nil)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "dl@example.com"), "dl@example.com")

	quoteID := submitTestQuote(t, h, st, "files@example.com")
	order := createTestOrder(t, h, quoteID, "files@example.com", "")

	// The order's file was registered by submitTestQuote but no bytes were
	// PUT — store real bytes under its key now.
	ctx := context.Background()
	o, err := st.GetOrderByShortID(ctx, order.OrderId)
	if err != nil {
		t.Fatal(err)
	}
	items, err := st.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil || len(items) != 1 || items[0].FileID == nil {
		t.Fatalf("items: %v %d", err, len(items))
	}
	fileID := *items[0].FileID
	f, err := st.GetFileByID(ctx, fileID)
	if err != nil {
		t.Fatal(err)
	}
	body := []byte("solid widget\nfacet normal 0 0 0\n")
	if err := strg.Put(ctx, *f.StorageKey, bytes.NewReader(body), int64(len(body)), "application/octet-stream"); err != nil {
		t.Fatalf("put: %v", err)
	}

	// Byte round-trip with attachment disposition.
	path := fmt.Sprintf("/api/v1/admin/orders/%s/files/%s", order.OrderId, fileID)
	rec := doJSONCookies(t, h, http.MethodGet, path, "", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("download: %d: %s", rec.Code, rec.Body)
	}
	if !bytes.Equal(rec.Body.Bytes(), body) {
		t.Fatalf("bytes mismatch: %q", rec.Body.Bytes())
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "attachment") ||
		!strings.Contains(cd, "widget.stl") {
		t.Fatalf("disposition %q", cd)
	}

	// A file not attached to the order → 404 file_not_found.
	foreignHash := strings.Repeat("cd", 32)
	fk := "test/" + foreignHash[:8]
	if _, err := st.InsertFile(ctx, store.InsertFileParams{
		FileName: "foreign.stl", FileSizeBytes: 10, Kind: "stl",
		Hash: &foreignHash, Source: "upload", StorageKey: &fk,
	}); err != nil {
		t.Fatal(err)
	}
	foreign, err := st.GetUploadedFileBySha256(ctx, &foreignHash)
	if err != nil {
		t.Fatal(err)
	}
	rec = doJSONCookies(t, h, http.MethodGet,
		fmt.Sprintf("/api/v1/admin/orders/%s/files/%s", order.OrderId, foreign.ID), "", admin)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("foreign file: %d, want 404", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != FileNotFound {
		t.Fatalf("code %q, want file_not_found", e.Code)
	}
}
