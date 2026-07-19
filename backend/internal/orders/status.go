// Package orders owns the order lifecycle state machine. Every status mutation
// — the payment-event pipeline, the admin refund endpoint, and later plan 07's
// board — routes through AssertTransition so an illegal edge can never be
// written, and through the SQL-guarded Mark* queries so a racing duplicate
// event can never double-apply one.
package orders

import "fmt"

// Status is an order lifecycle state (orders.status).
type Status string

const (
	StatusDraft        Status = "draft"
	StatusPaid         Status = "paid"
	StatusInProduction Status = "in_production"
	StatusShipped      Status = "shipped"
	StatusDelivered    Status = "delivered"
	StatusCancelled    Status = "cancelled"
	StatusRefunded     Status = "refunded"
)

// IllegalTransitionError is returned by AssertTransition for an edge the
// lifecycle does not allow.
type IllegalTransitionError struct {
	From Status
	To   Status
}

func (e *IllegalTransitionError) Error() string {
	return fmt.Sprintf("orders: illegal transition %s -> %s", e.From, e.To)
}

// Terminal states have no outgoing edges.
func (s Status) Terminal() bool {
	return s == StatusDelivered || s == StatusCancelled || s == StatusRefunded
}

// next holds the forward edges; cancelled is special-cased below because the
// lifecycle diagram allows it from every non-terminal state.
var next = map[Status][]Status{
	StatusDraft:        {StatusPaid},
	StatusPaid:         {StatusInProduction, StatusRefunded},
	StatusInProduction: {StatusShipped},
	StatusShipped:      {StatusDelivered},
}

// CanTransition reports whether the lifecycle allows from -> to.
func CanTransition(from, to Status) bool {
	if from.Terminal() {
		return false
	}
	if to == StatusCancelled {
		return true
	}
	for _, s := range next[from] {
		if s == to {
			return true
		}
	}
	return false
}

// AssertTransition returns an *IllegalTransitionError unless the edge is legal.
func AssertTransition(from, to Status) error {
	if !CanTransition(from, to) {
		return &IllegalTransitionError{From: from, To: to}
	}
	return nil
}
