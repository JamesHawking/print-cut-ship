package payments

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// ErrUnknownOrder is returned when an event references an order short id that
// does not exist. Delivery layers map it to a client-visible failure rather
// than an internal error.
var ErrUnknownOrder = errors.New("payments: unknown order")

// Pipeline applies provider payment events to orders. It is the ONLY path
// that flips paid/refunded — browser redirects never assert payment (P24/BLIK
// settle asynchronously in plan 18). Idempotent end to end: the ledger insert
// and the status transition commit in one transaction, and a redelivered
// event conflicts on provider_event_id and no-ops.
type Pipeline struct {
	Store  *store.Store
	Logger *slog.Logger
	// Email sends the receipt / refund status mail on applied transitions
	// (plan 06). Nil disables mail; sends always log-and-continue — a mail
	// failure must never turn into a webhook retry.
	Email *email.Service
	// PublicBaseURL builds the status-page link inside order mail.
	PublicBaseURL string
}

// ProcessEvent applies one verified provider event. Unknown event types are
// acknowledged and ignored, matching Stripe webhook etiquette (200 fast,
// never retry-storm on types we don't handle).
func (p *Pipeline) ProcessEvent(ctx context.Context, ev Event) error {
	order, err := p.Store.GetOrderByShortID(ctx, ev.OrderShortID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: %s", ErrUnknownOrder, ev.OrderShortID)
		}
		return fmt.Errorf("payments: load order %s: %w", ev.OrderShortID, err)
	}
	raw, err := json.Marshal(ev)
	if err != nil {
		return fmt.Errorf("payments: marshal event: %w", err)
	}
	payment := store.InsertPaymentEventParams{
		OrderID:         order.ID,
		Provider:        ev.Provider,
		ProviderEventID: ev.ID,
		Type:            ev.ledgerType(),
		AmountGrosze:    ev.AmountGrosze,
		Status:          ev.ledgerStatus(),
		Raw:             raw,
	}
	if ev.PaymentRef != "" {
		payment.PaymentRef = &ev.PaymentRef
	}

	switch ev.Type {
	case EventCheckoutCompleted:
		applied, err := p.Store.ApplyPaymentSucceeded(ctx, payment)
		if err != nil {
			if errors.Is(err, store.ErrTransitionRefused) {
				// The money moved but the state didn't (e.g. a stale session
				// paying an already-paid order). The ledger row is committed;
				// ack the event — a retry can't change the state — and page a
				// human via the error log.
				p.Logger.Error("payment recorded but transition refused; reconciliation needed",
					"orderId", ev.OrderShortID, "eventId", ev.ID, "err", err)
				return nil
			}
			return fmt.Errorf("payments: apply %s: %w", ev.ID, err)
		}
		if applied {
			p.Logger.Info("order paid", "orderId", ev.OrderShortID, "eventId", ev.ID)
			p.sendOrderMail(ctx, order, email.PaymentReceipt,
				"payment_receipt:"+order.ShortID, nil)
		}
		return nil
	case EventChargeRefunded:
		applied, err := p.Store.ApplyRefundSucceeded(ctx, payment)
		if err != nil {
			if errors.Is(err, store.ErrTransitionRefused) {
				p.Logger.Error("refund recorded but transition refused; reconciliation needed",
					"orderId", ev.OrderShortID, "eventId", ev.ID, "err", err)
				return nil
			}
			return fmt.Errorf("payments: apply %s: %w", ev.ID, err)
		}
		if applied {
			p.Logger.Info("order refunded", "orderId", ev.OrderShortID, "eventId", ev.ID)
			p.sendOrderMail(ctx, order, email.StatusChange,
				"status_refunded:"+order.ShortID, email.StatusChangeData{
					OrderShortID: order.ShortID,
					NewStatus:    "refunded",
					StatusURL:    p.statusURL(order),
				})
		}
		return nil
	case EventPaymentFailed:
		// Ledger-only: the order stays draft so the customer can retry checkout.
		if _, err := p.Store.InsertPaymentEvent(ctx, payment); err != nil {
			return fmt.Errorf("payments: record %s: %w", ev.ID, err)
		}
		p.Logger.Info("payment failed", "orderId", ev.OrderShortID, "eventId", ev.ID)
		return nil
	default:
		p.Logger.Info("ignoring payment event type", "type", string(ev.Type), "eventId", ev.ID)
		return nil
	}
}

// statusURL builds the tokenized public status-page link for an order.
func (p *Pipeline) statusURL(o store.Order) string {
	return fmt.Sprintf("%s/%s/order/%s", p.PublicBaseURL, o.Locale, o.StatusToken)
}

// sendOrderMail fires the lifecycle email for an applied transition (plan
// 06). data==nil builds the standard order payload (items, totals, status
// link). Deduped by the caller-supplied key, so a webhook replay is a no-op;
// failures log-and-continue — mail must never turn into an event retry.
func (p *Pipeline) sendOrderMail(ctx context.Context, o store.Order, tmpl email.Template, dedupeKey string, data any) {
	if p.Email == nil {
		return
	}
	if data == nil {
		items, err := p.Store.GetOrderItemsByOrderID(ctx, o.ID)
		if err != nil {
			p.Logger.Error("order email: load items failed", "orderId", o.ShortID, "err", err)
			return
		}
		orderData := email.OrderData{
			OrderShortID: o.ShortID,
			GrossTotal:   email.FormatPLN(o.GrossTotalGrosze, o.Locale),
			StatusURL:    p.statusURL(o),
		}
		for _, it := range items {
			orderData.Items = append(orderData.Items, email.OrderItemData{
				FileName:  it.FileName,
				Quantity:  it.Quantity,
				LineTotal: email.FormatPLN(it.LineTotalGrosze, o.Locale),
			})
		}
		data = orderData
	}
	if err := p.Email.SendTransactional(ctx, email.Input{
		To: o.Email, Template: tmpl, Locale: o.Locale,
		DedupeKey: dedupeKey, OrderID: &o.ID, UserID: o.UserID, Data: data,
	}); err != nil {
		p.Logger.Error("order email failed",
			"orderId", o.ShortID, "template", tmpl, "err", err)
	}
}

// ledgerType maps the event to the payments.type column.
func (ev Event) ledgerType() string {
	if ev.Type == EventChargeRefunded {
		return "refund"
	}
	return "payment"
}

func (ev Event) ledgerStatus() string {
	if ev.Type == EventPaymentFailed {
		return "failed"
	}
	return "succeeded"
}
