// Package email is the outbound-mail port (plan 04 §E, plan 06 supplies the
// production transport + PL/EN templates). Until plan 06 lands, ConsoleSender
// logs the message — production launch stays gated on plan 06.
package email

import (
	"context"
	"log/slog"
)

// Sender delivers a login code to an email address.
type Sender interface {
	SendLoginCode(ctx context.Context, email, code string) error
}

// ConsoleSender logs the code instead of sending it (dev/staging transport).
type ConsoleSender struct {
	Logger *slog.Logger
}

func (c ConsoleSender) SendLoginCode(_ context.Context, email, code string) error {
	logger := c.Logger
	if logger == nil {
		logger = slog.Default()
	}
	logger.Info("login code (console transport)", "email", email, "code", code)
	return nil
}
