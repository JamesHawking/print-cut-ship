package email

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// Transport is the provider port: one method, one message shape. Resend in
// production, a logging stand-in when RESEND_API_KEY is absent (dev).
type Transport interface {
	Send(ctx context.Context, msg Message) (providerMessageID string, err error)
}

// Message is a fully rendered outbound email.
type Message struct {
	From    string
	To      string
	ReplyTo string
	Subject string
	HTML    string
}

// Input is one SendTransactional call.
type Input struct {
	To        string
	Template  Template
	Locale    string
	DedupeKey string // empty = no dedupe (login codes)
	OrderID   *uuid.UUID
	UserID    *uuid.UUID
	Data      any
}

// Service is the send wrapper every trigger goes through (plan 06): dedupe
// via email_log, render, transport, audit row. It also satisfies the auth
// package's Sender port (SendLoginCode).
type Service struct {
	Store     *store.Store
	Logger    *slog.Logger
	Transport Transport
	FromOrders string
	FromAuth   string
	ReplyTo    string
	// Support is the operator inbox the STEP notification goes to
	// (EMAIL_SUPPORT).
	Support string
}

func (s *Service) logger() *slog.Logger {
	if s.Logger != nil {
		return s.Logger
	}
	return slog.Default()
}

func (s *Service) fromFor(tmpl Template) string {
	if tmpl == LoginCode {
		return s.FromAuth
	}
	return s.FromOrders
}

// SendTransactional renders and sends one email, writing an email_log row
// either way. A DedupeKey with a prior 'sent' row skips the send (webhook
// replays can't double-mail). The send error is returned — commerce callers
// log-and-continue (mail never fails an order), the auth caller propagates
// (the user needs the code).
func (s *Service) SendTransactional(ctx context.Context, in Input) error {
	logger := s.logger()
	if in.DedupeKey != "" && s.Store != nil {
		sent, err := s.Store.HasSentEmail(ctx, &in.DedupeKey)
		if err != nil {
			return fmt.Errorf("email: dedupe check: %w", err)
		}
		if sent {
			logger.Info("email: dedupe skip", "template", in.Template, "dedupeKey", in.DedupeKey)
			return nil
		}
	}

	subject, page, err := Render(in.Template, in.Locale, in.Data)
	if err != nil {
		return err
	}
	msg := Message{
		From:    s.fromFor(in.Template),
		To:      in.To,
		ReplyTo: s.ReplyTo,
		Subject: subject,
		HTML:    page,
	}
	providerID, sendErr := s.Transport.Send(ctx, msg)

	if s.Store != nil {
		row := store.InsertEmailLogParams{
			ToAddr:   in.To,
			Template: string(in.Template),
			Locale:   localeOrDefault(in.Locale),
			OrderID:  in.OrderID,
			UserID:   in.UserID,
		}
		if in.DedupeKey != "" {
			row.DedupeKey = &in.DedupeKey
		}
		if sendErr != nil {
			row.Status = "failed"
			msg := sendErr.Error()
			row.Error = &msg
		} else {
			row.Status = "sent"
			row.ProviderMessageID = &providerID
		}
		if logErr := s.Store.InsertEmailLog(ctx, row); logErr != nil {
			logger.Error("email: audit insert failed",
				"template", in.Template, "to", in.To, "err", logErr)
		}
	}
	if sendErr != nil {
		return fmt.Errorf("email: send %s to %s: %w", in.Template, in.To, sendErr)
	}
	logger.Info("email: sent",
		"template", in.Template, "to", in.To, "locale", localeOrDefault(in.Locale),
		"providerMessageId", providerID)
	return nil
}

// SendLoginCode adapts the generic wrapper to the auth port (no dedupe — a
// re-requested code must always go out; the auth service throttles).
func (s *Service) SendLoginCode(ctx context.Context, addr, code, locale string) error {
	return s.SendTransactional(ctx, Input{
		To:       addr,
		Template: LoginCode,
		Locale:   locale,
		Data:     LoginCodeData{Code: code},
	})
}

func localeOrDefault(locale string) string {
	if locale == "" {
		return "pl"
	}
	return locale
}
