package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// setupOrdersTest builds a DB-backed server with auth + the stub payment
// provider wired, mirroring cmd/api's construction.
func setupOrdersTest(t *testing.T) (http.Handler, *store.Store, *pgxpool.Pool, *captureMailer) {
	t.Helper()
	st, cfgID := setupTestStore(t)
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
	provider := payments.NewStub("http://test.local", pipeline)
	h := testHandler(t, Config{
		Store: st, Pricing: testHolder(cfgID), Auth: svc,
		Payments: provider, Pipeline: pipeline, PublicBaseURL: "http://test.local",
	}, nil)
	return h, st, pool, mailer
}

// submitTestQuote persists a file row and submits a quote referencing it, so
// order creation has a server-priced quote with a stored file to gate on.
func submitTestQuote(t *testing.T, h http.Handler, st *store.Store, email string) string {
	t.Helper()
	ctx := context.Background()
	hash := strings.Repeat("ab", 32)
	key := "test/" + hash[:8]
	if _, err := st.InsertFile(ctx, store.InsertFileParams{
		FileName: "widget.stl", FileSizeBytes: 1234, Kind: "stl",
		Hash: &hash, Source: "upload", StorageKey: &key,
	}); err != nil {
		t.Fatalf("insert file: %v", err)
	}
	var fileID string
	f, err := st.GetUploadedFileBySha256(ctx, &hash)
	if err != nil {
		t.Fatalf("file id: %v", err)
	}
	fileID = f.ID.String()
	part := fmt.Sprintf(`{"fileName": "widget.stl", "hash": %q, "fileId": %q,
		"metrics": {"volumeCm3": 100, "surfaceAreaCm2": 130,
		"bboxMm": {"x": 60, "y": 50, "z": 40}, "usedHullFallback": false},
		"process": "pla", "quantity": 2, "leadTime": "standard"}`, hash, fileID)
	rec := doJSON(t, h, http.MethodPost, "/api/v1/quotes",
		fmt.Sprintf(`{"email": %q, "country": "PL", "parts": [%s], "locale": "pl"}`, email, part))
	if rec.Code != http.StatusOK {
		t.Fatalf("submit quote status %d: %s", rec.Code, rec.Body)
	}
	var res SubmitQuoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	return res.QuoteId
}

const testAddress = `"name": "Jan Kowalski", "street": "Marszałkowska 1/2", "city": "Warszawa", "postalCode": "00-001"`

func createTestOrder(t *testing.T, h http.Handler, quoteID, email string, extra string) CreateOrderResponse {
	t.Helper()
	body := fmt.Sprintf(`{"quoteId": %q, "email": %q, "country": "PL", %s
		"shippingAddress": {%s}}`, quoteID, email, extra, testAddress)
	rec := doJSON(t, h, http.MethodPost, "/api/v1/orders", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("create order status %d: %s", rec.Code, rec.Body)
	}
	var res CreateOrderResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	return res
}

func TestCreateOrderHappyPath(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "jan@example.com")
	res := createTestOrder(t, h, quoteID, "jan@example.com",
		`"companyName": "ACME sp. z o.o.", "nip": "8567346215", "invoiceRequested": true,`)

	if !strings.HasPrefix(res.OrderId, "O-") || len(res.StatusToken) < 32 {
		t.Fatalf("bad response: %+v", res)
	}
	ctx := context.Background()
	o, err := st.GetOrderByShortID(ctx, res.OrderId)
	if err != nil {
		t.Fatal(err)
	}
	if o.Status != "draft" {
		t.Fatalf("status %q, want draft", o.Status)
	}
	q, err := st.GetQuoteByShortID(ctx, quoteID)
	if err != nil {
		t.Fatal(err)
	}
	if o.GrossTotalGrosze != q.GrossTotalGrosze || o.VatGrosze != q.VatGrosze {
		t.Fatalf("order money %d/%d != quote %d/%d",
			o.GrossTotalGrosze, o.VatGrosze, q.GrossTotalGrosze, q.VatGrosze)
	}
	if q.Status != "ordered" {
		t.Fatalf("quote status %q, want ordered", q.Status)
	}
	if o.Locale != "pl" || o.Nip == nil || *o.Nip != "8567346215" || !o.InvoiceRequested {
		t.Fatalf("order fields wrong: locale=%q nip=%v requested=%v", o.Locale, o.Nip, o.InvoiceRequested)
	}
	var snap map[string]any
	if err := json.Unmarshal(o.PricingSnapshot, &snap); err != nil || snap["grossTotalPln"] == nil {
		t.Fatalf("pricing snapshot missing: %v", err)
	}
	items, err := st.GetOrderItemsByOrderID(ctx, o.ID)
	if err != nil || len(items) != 1 {
		t.Fatalf("items %d err %v", len(items), err)
	}
	parts, _ := st.GetQuotePartsByQuoteID(ctx, q.ID)
	if items[0].UnitPriceGrosze != parts[0].UnitPriceGrosze ||
		items[0].LineTotalGrosze != parts[0].LineTotalGrosze {
		t.Fatalf("item grosze not copied verbatim")
	}
}

func TestCreateOrderRejects(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "piotr@example.com")

	// Unknown quote → 404.
	rec := doJSON(t, h, http.MethodPost, "/api/v1/orders",
		fmt.Sprintf(`{"quoteId": "Q-DEADBEEF", "email": "a@b.co", "country": "PL",
			"shippingAddress": {%s}}`, testAddress))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unknown quote status %d, want 404", rec.Code)
	}

	// Bad NIP checksum → 400 invalid_nip.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/orders",
		fmt.Sprintf(`{"quoteId": %q, "email": "a@b.co", "country": "PL", "nip": "8567346214",
			"shippingAddress": {%s}}`, quoteID, testAddress))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad nip status %d, want 400", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != InvalidNip {
		t.Fatalf("code %q, want invalid_nip", e.Code)
	}

	// Doctored price fields are structurally ignored: the order total equals
	// the stored quote's, not the body's.
	body := fmt.Sprintf(`{"quoteId": %q, "email": "a@b.co", "country": "PL",
		"grossTotalPln": 0.01, "unitPricePln": 0.01, "shippingAddress": {%s}}`, quoteID, testAddress)
	rec = doJSON(t, h, http.MethodPost, "/api/v1/orders", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("tamper-body status %d: %s", rec.Code, rec.Body)
	}
	var res CreateOrderResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	q, _ := st.GetQuoteByShortID(context.Background(), quoteID)
	o, _ := st.GetOrderByShortID(context.Background(), res.OrderId)
	if o.GrossTotalGrosze != q.GrossTotalGrosze {
		t.Fatalf("doctored total accepted: order %d, quote %d", o.GrossTotalGrosze, q.GrossTotalGrosze)
	}

	// Second conversion of the same quote → 409 quote_already_ordered.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/orders", body)
	if rec.Code != http.StatusConflict {
		t.Fatalf("reuse status %d, want 409", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != QuoteAlreadyOrdered {
		t.Fatalf("code %q, want quote_already_ordered", e.Code)
	}
}

func TestCreateOrderFileGate(t *testing.T) {
	h, st, pool, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "ania@example.com")
	// Soft-delete the stored file: the order must refuse.
	if _, err := pool.Exec(context.Background(), `UPDATE files SET deleted_at = now()`); err != nil {
		t.Fatal(err)
	}
	rec := doJSON(t, h, http.MethodPost, "/api/v1/orders",
		fmt.Sprintf(`{"quoteId": %q, "email": "a@b.co", "country": "PL",
			"shippingAddress": {%s}}`, quoteID, testAddress))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("file gate status %d, want 400", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != QuoteFileInvalid {
		t.Fatalf("code %q, want quote_file_invalid", e.Code)
	}
}

// checkoutSession extracts the stub session id from the fake-checkout URL.
func checkoutSession(t *testing.T, rawURL string) string {
	t.Helper()
	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) != 3 || parts[1] != "pay" {
		t.Fatalf("unexpected checkout URL %q", rawURL)
	}
	return parts[2]
}

// payTestOrder runs checkout + stub completion and returns the order id.
func payTestOrder(t *testing.T, h http.Handler, orderID string) {
	t.Helper()
	rec := doJSON(t, h, http.MethodPost, "/api/v1/orders/"+orderID+"/checkout", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("checkout status %d: %s", rec.Code, rec.Body)
	}
	var chk CheckoutResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &chk); err != nil {
		t.Fatal(err)
	}
	rec = doJSON(t, h, http.MethodPost, "/api/v1/payments/stub/complete",
		fmt.Sprintf(`{"session": %q}`, checkoutSession(t, chk.Url)))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("stub complete status %d: %s", rec.Code, rec.Body)
	}
}

func TestCheckoutAndStubPayment(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "kasia@example.com")
	order := createTestOrder(t, h, quoteID, "kasia@example.com", "")
	ctx := context.Background()

	// Checkout returns a fake-checkout URL; a second call returns the same
	// live session (Stripe Checkout semantics).
	rec := doJSON(t, h, http.MethodPost, "/api/v1/orders/"+order.OrderId+"/checkout", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("checkout status %d: %s", rec.Code, rec.Body)
	}
	var chk CheckoutResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &chk)
	if !strings.Contains(chk.Url, "/pay/cs_stub_") {
		t.Fatalf("checkout url %q, want fake-checkout page", chk.Url)
	}
	rec = doJSON(t, h, http.MethodPost, "/api/v1/orders/"+order.OrderId+"/checkout", "")
	var chk2 CheckoutResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &chk2)
	if chk.Url != chk2.Url {
		t.Fatalf("session not reused: %q vs %q", chk.Url, chk2.Url)
	}

	// Fake-checkout Pay → pipeline → paid, with paid_at + payment_ref.
	session := checkoutSession(t, chk.Url)
	rec = doJSON(t, h, http.MethodPost, "/api/v1/payments/stub/complete",
		fmt.Sprintf(`{"session": %q}`, session))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("stub complete status %d: %s", rec.Code, rec.Body)
	}
	o, err := st.GetOrderByShortID(ctx, order.OrderId)
	if err != nil {
		t.Fatal(err)
	}
	if o.Status != "paid" || !o.PaidAt.Valid || o.PaymentRef == nil {
		t.Fatalf("order not paid: status=%q paidAt=%v ref=%v", o.Status, o.PaidAt.Valid, o.PaymentRef)
	}

	// Checkout on a paid order → 409 order_wrong_state.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/orders/"+order.OrderId+"/checkout", "")
	if rec.Code != http.StatusConflict {
		t.Fatalf("checkout paid status %d, want 409", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != OrderWrongState {
		t.Fatalf("code %q, want order_wrong_state", e.Code)
	}
}

func TestPipelineIdempotency(t *testing.T) {
	h, st, pool, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "tomek@example.com")
	order := createTestOrder(t, h, quoteID, "tomek@example.com", "")
	ctx := context.Background()
	o, _ := st.GetOrderByShortID(ctx, order.OrderId)

	pipeline := &payments.Pipeline{Store: st, Logger: slog.New(slog.DiscardHandler)}
	ev := payments.Event{
		ID: "evt_test_fixed", Provider: "stub", Type: payments.EventCheckoutCompleted,
		OrderShortID: order.OrderId, PaymentRef: "pi_test", AmountGrosze: o.GrossTotalGrosze,
	}
	if err := pipeline.ProcessEvent(ctx, ev); err != nil {
		t.Fatalf("first delivery: %v", err)
	}
	if err := pipeline.ProcessEvent(ctx, ev); err != nil {
		t.Fatalf("redelivery: %v", err)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM payments WHERE order_id = $1`, o.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("payments rows %d, want 1 (redelivery no-op)", count)
	}
	o2, _ := st.GetOrderByShortID(ctx, order.OrderId)
	if o2.Status != "paid" {
		t.Fatalf("status %q, want paid", o2.Status)
	}
}

// A stale checkout session completing after a newer one already paid the
// order is a double-charge with a real PSP — the second event's ledger row
// must be committed even though the transition is refused (review fix).
func TestPipelineStalePaymentStillLedgered(t *testing.T) {
	h, st, pool, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "stale@example.com")
	order := createTestOrder(t, h, quoteID, "stale@example.com", "")
	ctx := context.Background()
	o, _ := st.GetOrderByShortID(ctx, order.OrderId)

	pipeline := &payments.Pipeline{Store: st, Logger: slog.New(slog.DiscardHandler)}
	first := payments.Event{
		ID: "evt_stale_1", Provider: "stub", Type: payments.EventCheckoutCompleted,
		OrderShortID: order.OrderId, PaymentRef: "pi_new", AmountGrosze: o.GrossTotalGrosze,
	}
	if err := pipeline.ProcessEvent(ctx, first); err != nil {
		t.Fatalf("first payment: %v", err)
	}
	stale := payments.Event{
		ID: "evt_stale_2", Provider: "stub", Type: payments.EventCheckoutCompleted,
		OrderShortID: order.OrderId, PaymentRef: "pi_stale", AmountGrosze: o.GrossTotalGrosze,
	}
	if err := pipeline.ProcessEvent(ctx, stale); err != nil {
		t.Fatalf("stale payment must be acked, got: %v", err)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM payments WHERE order_id = $1`, o.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("payments rows %d, want 2 (stale event ledgered)", count)
	}
	o2, _ := st.GetOrderByShortID(ctx, order.OrderId)
	if o2.Status != "paid" || o2.PaymentRef == nil || *o2.PaymentRef != "pi_new" {
		t.Fatalf("status %q ref %v — first payment must win", o2.Status, o2.PaymentRef)
	}
	// Refund against a non-paid order: ledgered too, state unchanged.
	h2, st2, pool2, _ := setupOrdersTest(t)
	quoteID2 := submitTestQuote(t, h2, st2, "refund@example.com")
	order2 := createTestOrder(t, h2, quoteID2, "refund@example.com", "")
	o3, _ := st2.GetOrderByShortID(ctx, order2.OrderId)
	pipeline2 := &payments.Pipeline{Store: st2, Logger: slog.New(slog.DiscardHandler)}
	if err := pipeline2.ProcessEvent(ctx, payments.Event{
		ID: "evt_refund_draft", Provider: "stub", Type: payments.EventChargeRefunded,
		OrderShortID: order2.OrderId, PaymentRef: "re_x", AmountGrosze: o3.GrossTotalGrosze,
	}); err != nil {
		t.Fatalf("refused refund must be acked, got: %v", err)
	}
	var refundRows int
	if err := pool2.QueryRow(ctx,
		`SELECT count(*) FROM payments WHERE order_id = $1 AND type = 'refund'`, o3.ID).Scan(&refundRows); err != nil {
		t.Fatal(err)
	}
	if refundRows != 1 {
		t.Fatalf("refund rows %d, want 1 (refused refund ledgered)", refundRows)
	}
	o4, _ := st2.GetOrderByShortID(ctx, order2.OrderId)
	if o4.Status != "draft" {
		t.Fatalf("status %q, want draft (refund refused)", o4.Status)
	}
}

func TestTrackOrder(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "ela@example.com")
	order := createTestOrder(t, h, quoteID, "ela@example.com", "")
	payTestOrder(t, h, order.OrderId)

	rec := doJSON(t, h, http.MethodGet, "/api/v1/orders/track/"+order.StatusToken, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("track status %d: %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "ela@example.com") ||
		strings.Contains(rec.Body.String(), "Marszałkowska") {
		t.Fatal("track leaks PII")
	}
	var view TrackedOrder
	if err := json.Unmarshal(rec.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if view.OrderId != order.OrderId || view.Status != "paid" || view.PaidAt == nil ||
		len(view.Items) != 1 || view.Totals.GrossTotalPln <= 0 {
		t.Fatalf("bad tracked view: %+v", view)
	}

	rec = doJSON(t, h, http.MethodGet, "/api/v1/orders/track/wrong-token", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("wrong token status %d, want 404", rec.Code)
	}
}

func TestRefundRoundTrip(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "admin@example.com")
	order := createTestOrder(t, h, quoteID, "admin@example.com", "")
	payTestOrder(t, h, order.OrderId)
	path := "/api/v1/admin/orders/" + order.OrderId + "/refund"

	// Anonymous → 401; customer → 403.
	rec := doJSON(t, h, http.MethodPost, path, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anon refund status %d, want 401", rec.Code)
	}
	customer := requestCodeAndVerify(t, h, mailer, "customer@example.com")
	rec = doJSONCookies(t, h, http.MethodPost, path, "", customer)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("customer refund status %d, want 403", rec.Code)
	}

	// Admin → 204, and the stub's synchronous confirm flips refunded.
	admin := requestCodeAndVerify(t, h, mailer, "boss@example.com")
	if _, err := pool.Exec(context.Background(),
		`UPDATE users SET role = 'admin' WHERE email = 'boss@example.com'`); err != nil {
		t.Fatal(err)
	}
	rec = doJSONCookies(t, h, http.MethodPost, path, "", admin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("admin refund status %d: %s", rec.Code, rec.Body)
	}
	o, err := st.GetOrderByShortID(context.Background(), order.OrderId)
	if err != nil {
		t.Fatal(err)
	}
	if o.Status != "refunded" {
		t.Fatalf("status %q, want refunded", o.Status)
	}

	// Refunding again → 409 (terminal state).
	rec = doJSONCookies(t, h, http.MethodPost, path, "", admin)
	if rec.Code != http.StatusConflict {
		t.Fatalf("re-refund status %d, want 409", rec.Code)
	}
}

func TestFailedPaymentKeepsDraft(t *testing.T) {
	h, st, _, _ := setupOrdersTest(t)
	quoteID := submitTestQuote(t, h, st, "fail@example.com")
	order := createTestOrder(t, h, quoteID, "fail@example.com", "")

	rec := doJSON(t, h, http.MethodPost, "/api/v1/orders/"+order.OrderId+"/checkout", "")
	var chk CheckoutResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &chk)
	rec = doJSON(t, h, http.MethodPost, "/api/v1/payments/stub/complete",
		fmt.Sprintf(`{"session": %q, "outcome": "fail"}`, checkoutSession(t, chk.Url)))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("fail complete status %d: %s", rec.Code, rec.Body)
	}
	o, err := st.GetOrderByShortID(context.Background(), order.OrderId)
	if err != nil {
		t.Fatal(err)
	}
	if o.Status != "draft" {
		t.Fatalf("status %q, want draft after failed payment", o.Status)
	}
	// The draft can check out again (customer retries).
	rec = doJSON(t, h, http.MethodPost, "/api/v1/orders/"+order.OrderId+"/checkout", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("re-checkout status %d: %s", rec.Code, rec.Body)
	}
}
