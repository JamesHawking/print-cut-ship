// Package payments is the payment-provider port (plan 05, amended 2026-07-19).
// The order flow is built against Stripe Checkout's semantics — create a
// hosted session, redirect the browser, learn the outcome from an
// asynchronous provider event — but the only implementation here is the stub.
// Plan 18 drops in stripe-go without touching the pipeline or the handlers:
// it feeds the same Event types through the same ProcessEvent idempotency
// spine after verifying the webhook signature.
package payments

import (
	"context"
	"time"
)

// CheckoutParams are everything a Provider needs to build a hosted checkout
// session for a persisted draft order. Money is integer grosze, which is also
// Stripe's PLN minor unit — no conversion anywhere.
type CheckoutParams struct {
	OrderShortID     string // provider's client_reference_id
	GrossTotalGrosze int32
	SuccessURL       string // browser lands here after paying (never authoritative)
	CancelURL        string
	Locale           string // 'pl' | 'en'
}

// CheckoutSession is a provider-hosted payment page the browser redirects to.
type CheckoutSession struct {
	ID        string
	URL       string
	ExpiresAt time.Time
}

// Provider moves money. Implementations: Stub (this package, interim),
// Stripe (plan 18).
type Provider interface {
	// Name is stored on payments rows ('stub' | 'stripe') for provenance.
	Name() string
	CreateCheckoutSession(ctx context.Context, p CheckoutParams) (CheckoutSession, error)
	// Refund requests the money back. Confirmation is asynchronous — it
	// arrives as a charge.refunded event through the pipeline (the stub feeds
	// it synchronously in-process; Stripe's webhook delivers it in plan 18).
	Refund(ctx context.Context, paymentRef string, amountGrosze int32) (refundRef string, err error)
}

// EventType mirrors the Stripe event names the pipeline understands, so
// plan 18's webhook handler is a pure verification + mapping layer.
type EventType string

const (
	EventCheckoutCompleted EventType = "checkout.session.completed"
	EventChargeRefunded    EventType = "charge.refunded"
	EventPaymentFailed     EventType = "payment_intent.payment_failed"
)

// Event is one provider payment event, already verified/authenticated by the
// delivery layer (stub route or Stripe webhook).
type Event struct {
	// ID is the provider-unique event id — the idempotency key. Stripe
	// redelivers; the payments.provider_event_id unique constraint makes
	// redelivery a no-op.
	ID string
	// Provider is the ledger's provenance column ('stub' | 'stripe'), set by
	// the delivery layer.
	Provider     string
	Type         EventType
	OrderShortID string
	// PaymentRef is the provider's payment object id (Stripe payment intent
	// in plan 18, synthetic pi_stub_* for the stub).
	PaymentRef   string
	AmountGrosze int32
}
