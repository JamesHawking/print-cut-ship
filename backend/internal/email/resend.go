package email

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"

	"github.com/resend/resend-go/v2"
)

// ResendTransport delivers via the Resend API (plan 06 — DECISIONS.md pins
// Resend for managed deliverability). Domain authentication (SPF/DKIM/DMARC)
// is ops-side; see plans/engineering/runbooks/email-dns.md.
type ResendTransport struct {
	client *resend.Client
}

func NewResendTransport(apiKey string) *ResendTransport {
	return &ResendTransport{client: resend.NewClient(apiKey)}
}

func (t *ResendTransport) Send(ctx context.Context, msg Message) (string, error) {
	resp, err := t.client.Emails.SendWithContext(ctx, &resend.SendEmailRequest{
		From:    msg.From,
		To:      []string{msg.To},
		ReplyTo: msg.ReplyTo,
		Subject: msg.Subject,
		Html:    msg.HTML,
	})
	if err != nil {
		return "", err
	}
	return resp.Id, nil
}

// LogTransport is the no-key degradation (same pattern as BAMBU_CLOUD_TOKEN):
// the full send path runs — render, dedupe, email_log audit — but the message
// goes to the log with a synthetic provider id instead of the wire.
type LogTransport struct {
	Logger *slog.Logger
}

func (t LogTransport) Send(_ context.Context, msg Message) (string, error) {
	logger := t.Logger
	if logger == nil {
		logger = slog.Default()
	}
	id := "log-" + randomHex(8)
	logger.Warn("email: log transport (RESEND_API_KEY absent) — not delivered",
		"providerMessageId", id, "from", msg.From, "to", msg.To,
		"replyTo", msg.ReplyTo, "subject", msg.Subject)
	return id, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("email: rand: %v", err))
	}
	return hex.EncodeToString(b)
}
