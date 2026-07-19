package orders

import (
	"errors"
	"testing"
)

func TestCanTransitionMatrix(t *testing.T) {
	legal := []struct{ from, to Status }{
		{StatusDraft, StatusPaid},
		{StatusDraft, StatusCancelled},
		{StatusPaid, StatusInProduction},
		{StatusPaid, StatusRefunded},
		{StatusPaid, StatusCancelled},
		{StatusInProduction, StatusShipped},
		{StatusInProduction, StatusCancelled},
		{StatusShipped, StatusDelivered},
		{StatusShipped, StatusCancelled},
	}
	for _, edge := range legal {
		if !CanTransition(edge.from, edge.to) {
			t.Errorf("CanTransition(%s, %s) = false, want legal", edge.from, edge.to)
		}
		if err := AssertTransition(edge.from, edge.to); err != nil {
			t.Errorf("AssertTransition(%s, %s) = %v, want nil", edge.from, edge.to, err)
		}
	}

	all := []Status{
		StatusDraft, StatusPaid, StatusInProduction, StatusShipped,
		StatusDelivered, StatusCancelled, StatusRefunded,
	}
	isLegal := func(from, to Status) bool {
		for _, edge := range legal {
			if edge.from == from && edge.to == to {
				return true
			}
		}
		return false
	}
	for _, from := range all {
		for _, to := range all {
			if isLegal(from, to) {
				continue
			}
			if CanTransition(from, to) {
				t.Errorf("CanTransition(%s, %s) = true, want illegal", from, to)
			}
			err := AssertTransition(from, to)
			if err == nil {
				t.Errorf("AssertTransition(%s, %s) = nil, want error", from, to)
			} else {
				var ite *IllegalTransitionError
				if !errors.As(err, &ite) {
					t.Errorf("AssertTransition(%s, %s) error type = %T, want *IllegalTransitionError", from, to, err)
				}
			}
		}
	}
}

func TestTerminalStates(t *testing.T) {
	for _, s := range []Status{StatusDelivered, StatusCancelled, StatusRefunded} {
		if !s.Terminal() {
			t.Errorf("%s.Terminal() = false, want true", s)
		}
	}
	for _, s := range []Status{StatusDraft, StatusPaid, StatusInProduction, StatusShipped} {
		if s.Terminal() {
			t.Errorf("%s.Terminal() = true, want false", s)
		}
	}
}
