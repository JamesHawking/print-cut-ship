package payments

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// Stub is the interim Provider (PAYMENTS_PROVIDER=stub, the default until
// plan 18). It mirrors Stripe Checkout's semantics exactly: a hosted session
// whose URL is the frontend's fake-checkout page, asynchronous confirmation
// through the pipeline (fed by the stub-complete route / synchronously for
// refunds), and synthetic provider ids so the ledger reads like Stripe's.
//
// The stub lets the whole order flow — redirect, webhook-shaped events,
// idempotency, confirmation/status pages, refunds — run and be tested end to
// end before the Stripe account exists. It must never be selectable in
// production; plan 18 owns that gate.
type Stub struct {
	// BaseURL is the frontend origin (PUBLIC_BASE_URL) the fake-checkout URLs
	// are built on.
	BaseURL  string
	Pipeline *Pipeline
}

// NewStub wires the stub provider. The pipeline is required: Refund feeds its
// own confirmation event through it, exactly as Stripe's webhook will.
func NewStub(baseURL string, pipeline *Pipeline) *Stub {
	return &Stub{BaseURL: baseURL, Pipeline: pipeline}
}

func (s *Stub) Name() string { return "stub" }

// CreateCheckoutSession mints a synthetic session id and points the browser
// at the fake-checkout page, carrying the success/cancel URLs as query params
// like a hosted PSP redirect flow would.
func (s *Stub) CreateCheckoutSession(_ context.Context, p CheckoutParams) (CheckoutSession, error) {
	id := "cs_stub_" + randHex(8)
	url := fmt.Sprintf("%s/%s/pay/%s?success=%s&cancel=%s",
		s.BaseURL, p.Locale, id, p.SuccessURL, p.CancelURL)
	// Stripe Checkout sessions expire after 24h; mirror that.
	return CheckoutSession{ID: id, URL: url, ExpiresAt: time.Now().Add(24 * time.Hour)}, nil
}

// Refund feeds a charge.refunded event through the pipeline synchronously —
// the stub's stand-in for Stripe's webhook confirmation. The requesting
// handler only initiates; the pipeline flips the status, preserving the
// request/confirm split.
func (s *Stub) Refund(ctx context.Context, paymentRef string, amountGrosze int32) (string, error) {
	refundRef := "re_stub_" + randHex(8)
	order, err := s.Pipeline.Store.GetOrderByPaymentRef(ctx, &paymentRef)
	if err != nil {
		return "", fmt.Errorf("stub refund: %w", err)
	}
	if err := s.Pipeline.ProcessEvent(ctx, Event{
		ID:           "evt_stub_" + randHex(8),
		Provider:     s.Name(),
		Type:         EventChargeRefunded,
		OrderShortID: order.ShortID,
		PaymentRef:   refundRef,
		AmountGrosze: amountGrosze,
	}); err != nil {
		return "", fmt.Errorf("stub refund: %w", err)
	}
	return refundRef, nil
}

// CompleteEvent builds the synthetic checkout.session.completed event the
// stub-complete route feeds into the pipeline when the fake-checkout Pay
// button is pressed.
func (s *Stub) CompleteEvent(orderShortID string, amountGrosze int32) Event {
	return Event{
		ID:           "evt_stub_" + randHex(8),
		Provider:     s.Name(),
		Type:         EventCheckoutCompleted,
		OrderShortID: orderShortID,
		PaymentRef:   "pi_stub_" + randHex(8),
		AmountGrosze: amountGrosze,
	}
}

// FailedEvent builds the synthetic payment_intent.payment_failed event for
// the fake-checkout "fail" path.
func (s *Stub) FailedEvent(orderShortID string, amountGrosze int32) Event {
	ev := s.CompleteEvent(orderShortID, amountGrosze)
	ev.Type = EventPaymentFailed
	return ev
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
