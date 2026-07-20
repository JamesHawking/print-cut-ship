package email

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/db"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// fakeTransport records messages and can be set to fail.
type fakeTransport struct {
	mu   sync.Mutex
	sent []Message
	err  error
}

func (f *fakeTransport) Send(_ context.Context, msg Message) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return "", f.err
	}
	f.sent = append(f.sent, msg)
	return fmt.Sprintf("fake-%d", len(f.sent)), nil
}

func (f *fakeTransport) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.sent)
}

func setupEmailTest(t *testing.T) (*Service, *store.Store, *fakeTransport, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed email test")
	}
	ctx := context.Background()
	if err := db.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, `TRUNCATE email_log RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	st := store.NewStore(pool)
	transport := &fakeTransport{}
	svc := &Service{
		Store: st, Transport: transport,
		FromOrders: "orders@test.local", FromAuth: "no-reply@test.local",
		ReplyTo: "support@test.local", Support: "support@test.local",
	}
	return svc, st, transport, pool
}

// A dedupe key with a prior success skips the second send entirely.
func TestSendTransactionalDedupes(t *testing.T) {
	svc, st, transport, _ := setupEmailTest(t)
	ctx := context.Background()
	in := Input{
		To: "jan@example.com", Template: OrderConfirmation, Locale: "pl",
		DedupeKey: "order_confirmation:O-TEST0001", Data: fixtureOrderData(),
	}
	if err := svc.SendTransactional(ctx, in); err != nil {
		t.Fatalf("first send: %v", err)
	}
	if err := svc.SendTransactional(ctx, in); err != nil {
		t.Fatalf("second send: %v", err)
	}
	if transport.count() != 1 {
		t.Fatalf("transport calls %d, want 1 (dedupe)", transport.count())
	}
	sent, err := st.HasSentEmail(ctx, &in.DedupeKey)
	if err != nil || !sent {
		t.Fatalf("HasSentEmail %v %v", sent, err)
	}
}

// A failed send writes a 'failed' row and the same key can be retried — the
// partial unique index only guards 'sent' (migration 00007 deviation).
func TestFailedSendRetries(t *testing.T) {
	svc, _, transport, pool := setupEmailTest(t)
	ctx := context.Background()
	transport.err = errors.New("provider down")
	in := Input{
		To: "jan@example.com", Template: OrderConfirmation, Locale: "pl",
		DedupeKey: "order_confirmation:O-TEST0002", Data: fixtureOrderData(),
	}
	if err := svc.SendTransactional(ctx, in); err == nil {
		t.Fatal("expected send error to propagate")
	}
	sent, err := svc.Store.HasSentEmail(ctx, &in.DedupeKey)
	if err != nil || sent {
		t.Fatalf("failed send must not count as sent: %v %v", sent, err)
	}
	transport.err = nil
	if err := svc.SendTransactional(ctx, in); err != nil {
		t.Fatalf("retry under the same key: %v", err)
	}
	if transport.count() != 1 {
		t.Fatalf("transport calls %d, want 1", transport.count())
	}
	// one failed + one sent row for the key
	var n int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM email_log WHERE dedupe_key = $1`, in.DedupeKey).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("email_log rows %d, want 2 (failed + sent)", n)
	}
}

// Login codes never dedupe: a re-request must go out again.
func TestLoginCodeNoDedupe(t *testing.T) {
	svc, _, transport, _ := setupEmailTest(t)
	ctx := context.Background()
	for range 2 {
		if err := svc.SendLoginCode(ctx, "jan@example.com", "123456", "en"); err != nil {
			t.Fatal(err)
		}
	}
	if transport.count() != 2 {
		t.Fatalf("transport calls %d, want 2", transport.count())
	}
}

// From/reply-to stamping: auth mail from FromAuth, everything else
// FromOrders, reply-to always the support inbox.
func TestFromReplyToStamping(t *testing.T) {
	svc, _, transport, _ := setupEmailTest(t)
	ctx := context.Background()
	if err := svc.SendLoginCode(ctx, "jan@example.com", "123456", "pl"); err != nil {
		t.Fatal(err)
	}
	if err := svc.SendTransactional(ctx, Input{
		To: "jan@example.com", Template: StepAck, Locale: "pl",
		Data: StepAckData{FileName: "x.step"},
	}); err != nil {
		t.Fatal(err)
	}
	transport.mu.Lock()
	defer transport.mu.Unlock()
	auth, order := transport.sent[0], transport.sent[1]
	if auth.From != "no-reply@test.local" {
		t.Errorf("auth from %q", auth.From)
	}
	if order.From != "orders@test.local" {
		t.Errorf("order from %q", order.From)
	}
	for i, m := range []Message{auth, order} {
		if m.ReplyTo != "support@test.local" {
			t.Errorf("msg %d reply-to %q", i, m.ReplyTo)
		}
		if m.Subject == "" || strings.Contains(m.Subject, "{{") {
			t.Errorf("msg %d subject %q", i, m.Subject)
		}
	}
}
