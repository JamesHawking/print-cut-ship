package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/payments"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// Plan 06 trigger tests: every commerce/auth event fires the right template
// exactly once, through a real email.Service over a recording transport.

type recordTransport struct {
	mu   sync.Mutex
	sent []email.Message
	err  error
}

func (rt *recordTransport) Send(_ context.Context, msg email.Message) (string, error) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	if rt.err != nil {
		return "", rt.err
	}
	rt.sent = append(rt.sent, msg)
	return fmt.Sprintf("rec-%d", len(rt.sent)), nil
}

func (rt *recordTransport) messages() []email.Message {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return append([]email.Message(nil), rt.sent...)
}

// setupMailTest mirrors setupOrdersTest but routes all mail through a real
// email.Service (render + dedupe + email_log audit) over a recording
// transport, so triggers are asserted end to end.
func setupMailTest(t *testing.T) (http.Handler, *store.Store, *pgxpool.Pool, *captureMailer, *recordTransport) {
	t.Helper()
	st, cfgID := setupTestStore(t)
	pool, err := pgxpool.New(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE login_codes, sessions, payments, order_items, invoices, email_log RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	mailer := &captureMailer{}
	svc := auth.NewService(st, mailer, nil, 10*time.Minute, 30*24*time.Hour)
	transport := &recordTransport{}
	emailSvc := &email.Service{
		Store: st, Logger: slog.New(slog.DiscardHandler), Transport: transport,
		FromOrders: "orders@test.local", FromAuth: "no-reply@test.local",
		ReplyTo: "support@test.local", Support: "support@test.local",
	}
	pipeline := &payments.Pipeline{
		Store: st, Logger: slog.New(slog.DiscardHandler),
		Email: emailSvc, PublicBaseURL: "http://test.local",
	}
	provider := payments.NewStub("http://test.local", pipeline)
	h := testHandler(t, Config{
		Store: st, Pricing: testHolder(cfgID), Auth: svc, Email: emailSvc,
		Payments: provider, Pipeline: pipeline, PublicBaseURL: "http://test.local",
	}, nil)
	return h, st, pool, mailer, transport
}

func countEmailLog(t *testing.T, pool *pgxpool.Pool, template string) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM email_log WHERE template = $1 AND status = 'sent'`, template).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestOrderCreateSendsConfirmation(t *testing.T) {
	h, st, pool, _, transport := setupMailTest(t)
	quoteID := submitTestQuote(t, h, st, "confirm@example.com")
	order := createTestOrder(t, h, quoteID, "confirm@example.com", "")

	msgs := transport.messages()
	if len(msgs) != 1 {
		t.Fatalf("messages %d, want 1 (confirmation)", len(msgs))
	}
	m := msgs[0]
	if m.To != "confirm@example.com" || m.ReplyTo != "support@test.local" {
		t.Errorf("to/reply-to wrong: %q %q", m.To, m.ReplyTo)
	}
	if !strings.Contains(m.HTML, order.OrderId) ||
		!strings.Contains(m.HTML, "/pl/order/"+order.StatusToken) {
		t.Errorf("body missing order id / status url")
	}
	if n := countEmailLog(t, pool, "order_confirmation"); n != 1 {
		t.Errorf("email_log sent rows %d, want 1", n)
	}
}

func TestPipelineSendsOneReceiptOnReplay(t *testing.T) {
	h, st, pool, _, transport := setupMailTest(t)
	quoteID := submitTestQuote(t, h, st, "receipt@example.com")
	order := createTestOrder(t, h, quoteID, "receipt@example.com", "")
	payTestOrder(t, h, order.OrderId)
	if n := countEmailLog(t, pool, "payment_receipt"); n != 1 {
		t.Fatalf("receipt rows %d, want 1", n)
	}

	// Webhook replay: the same provider event again → no second receipt.
	o, _ := st.GetOrderByShortID(context.Background(), order.OrderId)
	pipeline := &payments.Pipeline{
		Store: st, Logger: slog.New(slog.DiscardHandler),
		Email: &email.Service{
			Store: st, Logger: slog.New(slog.DiscardHandler), Transport: transport,
			FromOrders: "orders@test.local", ReplyTo: "support@test.local",
		},
		PublicBaseURL: "http://test.local",
	}
	ev := payments.Event{
		ID: "evt_replay", Provider: "stub", Type: payments.EventCheckoutCompleted,
		OrderShortID: order.OrderId, PaymentRef: "pi_replay", AmountGrosze: o.GrossTotalGrosze,
	}
	if err := pipeline.ProcessEvent(context.Background(), ev); err != nil {
		t.Fatalf("replay: %v", err)
	}
	if n := countEmailLog(t, pool, "payment_receipt"); n != 1 {
		t.Fatalf("receipt rows after replay %d, want 1", n)
	}
	if len(transport.messages()) != 2 { // confirmation + one receipt
		t.Fatalf("messages %d, want 2", len(transport.messages()))
	}
}

func TestAdminTransitionSendsStatusMails(t *testing.T) {
	h, st, pool, mailer, transport := setupMailTest(t)
	quoteID := submitTestQuote(t, h, st, "status@example.com")
	order := createTestOrder(t, h, quoteID, "status@example.com", "")
	payTestOrder(t, h, order.OrderId)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "ops@example.com"), "ops@example.com")
	path := "/api/v1/admin/orders/" + order.OrderId + "/transition"

	rec := doJSONCookies(t, h, http.MethodPost, path, `{"to": "in_production"}`, admin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("in_production status %d: %s", rec.Code, rec.Body)
	}
	if n := countEmailLog(t, pool, "status_change"); n != 1 {
		t.Fatalf("status_change rows %d, want 1", n)
	}
	last := transport.messages()[len(transport.messages())-1]
	if !strings.Contains(last.HTML, "w produkcji") {
		t.Errorf("in_production mail body missing variant copy")
	}

	// Repeating the same admin click is a 409, but even a retried
	// notification dedupes on (to, order).
	rec = doJSONCookies(t, h, http.MethodPost, path,
		`{"to": "shipped", "trackingNumber": "DPD-123456"}`, admin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("shipped status %d: %s", rec.Code, rec.Body)
	}
	if n := countEmailLog(t, pool, "shipped"); n != 1 {
		t.Fatalf("shipped rows %d, want 1", n)
	}
	last = transport.messages()[len(transport.messages())-1]
	if !strings.Contains(last.HTML, "DPD-123456") {
		t.Errorf("shipped mail missing tracking number")
	}
}

func TestRefundSendsStatusMail(t *testing.T) {
	h, st, pool, mailer, _ := setupMailTest(t)
	quoteID := submitTestQuote(t, h, st, "refundmail@example.com")
	order := createTestOrder(t, h, quoteID, "refundmail@example.com", "")
	payTestOrder(t, h, order.OrderId)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "refunder@example.com"), "refunder@example.com")
	rec := doJSONCookies(t, h, http.MethodPost,
		"/api/v1/admin/orders/"+order.OrderId+"/refund", "", admin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("refund status %d: %s", rec.Code, rec.Body)
	}
	if n := countEmailLog(t, pool, "status_change"); n != 1 {
		t.Fatalf("refund status_change rows %d, want 1", n)
	}
}

func TestStepQuoteSendsAckAndNotify(t *testing.T) {
	h, _, pool, _, transport := setupMailTest(t)
	rec := doJSON(t, h, http.MethodPost, "/api/v1/step-quotes",
		`{"email": "step@example.com", "fileName": "korpus.step", "fileSize": 2450000, "locale": "en"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	msgs := transport.messages()
	if len(msgs) != 2 {
		t.Fatalf("messages %d, want 2 (ack + notify)", len(msgs))
	}
	ack, notify := msgs[0], msgs[1]
	if ack.To != "step@example.com" || !strings.Contains(ack.Subject, "korpus.step") ||
		!strings.Contains(ack.HTML, "4 working hours") {
		t.Errorf("ack wrong: to=%q subject=%q", ack.To, ack.Subject)
	}
	if notify.To != "support@test.local" ||
		!strings.Contains(notify.HTML, "step@example.com") ||
		!strings.Contains(notify.HTML, "2.5 MB") {
		t.Errorf("notify wrong: to=%q", notify.To)
	}
	if n := countEmailLog(t, pool, "step_ack"); n != 1 {
		t.Errorf("step_ack rows %d, want 1", n)
	}
	if n := countEmailLog(t, pool, "step_notify"); n != 1 {
		t.Errorf("step_notify rows %d, want 1", n)
	}
}

// The auth flow is the one caller that propagates a send failure — the user
// needs the code, so a dead provider must surface as a 500.
func TestAuthRequestCodePropagatesTransportFailure(t *testing.T) {
	st, cfgID := setupTestStore(t)
	pool, err := pgxpool.New(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE login_codes, email_log RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	emailSvc := &email.Service{
		Store: st, Logger: slog.New(slog.DiscardHandler),
		Transport: &recordTransport{err: errors.New("provider down")},
		FromAuth:  "no-reply@test.local", ReplyTo: "support@test.local",
	}
	svc := auth.NewService(st, emailSvc, nil, 10*time.Minute, 30*24*time.Hour)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID), Auth: svc}, nil)

	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code",
		`{"email": "fail@example.com", "locale": "en"}`)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500", rec.Code)
	}
	var n int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM email_log WHERE status = 'failed'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("failed rows %d, want 1", n)
	}
}

// request-code passes the request locale through to the login mail.
func TestAuthRequestCodeLocale(t *testing.T) {
	st, cfgID := setupTestStore(t)
	transport := &recordTransport{}
	emailSvc := &email.Service{
		Store: st, Logger: slog.New(slog.DiscardHandler), Transport: transport,
		FromAuth: "no-reply@test.local", ReplyTo: "support@test.local",
	}
	svc := auth.NewService(st, emailSvc, nil, 10*time.Minute, 30*24*time.Hour)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID), Auth: svc}, nil)

	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code",
		`{"email": "loc@example.com", "locale": "en"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	msgs := transport.messages()
	if len(msgs) != 1 || !strings.Contains(msgs[0].HTML, "one-time code") {
		t.Fatalf("expected EN login mail, got %+v", msgs)
	}
}
