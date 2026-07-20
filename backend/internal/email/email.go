// Package email is the outbound-mail port plus its plan-06 implementation:
// pre-rendered Go templates (instant-quote/src/emails → templates/), a
// dedupe/logging send wrapper over email_log, and Resend/log transports.
package email

import "context"

// Sender delivers a login code to an email address (the auth port, plan 04).
type Sender interface {
	SendLoginCode(ctx context.Context, email, code, locale string) error
}
