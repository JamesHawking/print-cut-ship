package email

import (
	"bytes"
	"embed"
	"fmt"
	htmltemplate "html/template"
	"strings"
	texttemplate "text/template"
)

// Pre-rendered templates (plan 06): instant-quote/src/emails React Email
// sources are rendered by `bun run emails:build` into templates/<name>.<locale>.html
// (html/template) + <name>.<locale>.subject.txt (text/template). Committed
// artifacts — never hand-edit; the drift gate re-renders and diffs.
//
//go:embed templates
var templatesFS embed.FS

// Template is the closed set of transactional emails (registry in
// instant-quote/scripts/build-emails.ts must match).
type Template string

const (
	LoginCode         Template = "login_code"
	OrderConfirmation Template = "order_confirmation"
	PaymentReceipt    Template = "payment_receipt"
	StatusChange      Template = "status_change"
	Shipped           Template = "shipped"
	StepAck           Template = "step_ack"
	StepNotify        Template = "step_notify" // operator-facing, pl only
)

// renderLocales is the fallback chain — unknown/absent locales land on pl.
var renderLocales = []string{"pl", "en"}

type compiled struct {
	subject *texttemplate.Template
	html    *htmltemplate.Template
}

var compiledTemplates = map[Template]map[string]compiled{}

func init() {
	for _, tmpl := range []Template{
		LoginCode, OrderConfirmation, PaymentReceipt,
		StatusChange, Shipped, StepAck, StepNotify,
	} {
		compiledTemplates[tmpl] = map[string]compiled{}
		for _, locale := range renderLocales {
			base := fmt.Sprintf("templates/%s.%s", tmpl, locale)
			subjectSrc, err := templatesFS.ReadFile(base + ".subject.txt")
			if err != nil {
				if locale == "pl" {
					panic(fmt.Sprintf("email: missing %s.subject.txt: %v", base, err))
				}
				continue // non-pl locales are optional (step_notify is pl-only)
			}
			htmlSrc, err := templatesFS.ReadFile(base + ".html")
			if err != nil {
				panic(fmt.Sprintf("email: missing %s.html: %v", base, err))
			}
			subject, err := texttemplate.New(string(tmpl)).Parse(strings.TrimSpace(string(subjectSrc)))
			if err != nil {
				panic(fmt.Sprintf("email: parse %s.subject.txt: %v", base, err))
			}
			page, err := htmltemplate.New(string(tmpl)).Parse(string(htmlSrc))
			if err != nil {
				panic(fmt.Sprintf("email: parse %s.html: %v", base, err))
			}
			compiledTemplates[tmpl][locale] = compiled{subject: subject, html: page}
		}
	}
}

// Render executes the embedded template for locale (fallback pl), returning
// the subject line and the HTML body.
func Render(tmpl Template, locale string, data any) (string, string, error) {
	byLocale, ok := compiledTemplates[tmpl]
	if !ok {
		return "", "", fmt.Errorf("email: unknown template %q", tmpl)
	}
	c, ok := byLocale[locale]
	if !ok {
		c = byLocale["pl"]
	}
	var subject, page bytes.Buffer
	if err := c.subject.Execute(&subject, data); err != nil {
		return "", "", fmt.Errorf("email: subject %s/%s: %w", tmpl, locale, err)
	}
	if err := c.html.Execute(&page, data); err != nil {
		return "", "", fmt.Errorf("email: html %s/%s: %w", tmpl, locale, err)
	}
	return subject.String(), page.String(), nil
}

// ------------------------------------------------------ template payloads

type LoginCodeData struct {
	Code string
}

type OrderItemData struct {
	FileName  string
	Quantity  int32
	LineTotal string // preformatted ("123,45 zł")
}

type OrderData struct {
	OrderShortID string
	GrossTotal   string // preformatted
	StatusURL    string
	Items        []OrderItemData
}

type StatusChangeData struct {
	OrderShortID string
	NewStatus    string // in_production | delivered | cancelled | refunded
	StatusURL    string
}

type ShippedData struct {
	OrderShortID   string
	TrackingNumber string
	StatusURL      string
}

type StepAckData struct {
	FileName string
}

type StepNotifyData struct {
	RequestID string
	Email     string
	FileName  string
	FileSize  string // preformatted
}

// FormatPLN renders integer grosze for an email body (money is always gross,
// VAT-inclusive — backend/internal/money). Kept here so every caller
// preformats identically instead of pushing floats into templates.
func FormatPLN(grosze int32, locale string) string {
	pln := float64(grosze) / 100
	if locale == "en" {
		return fmt.Sprintf("%.2f PLN", pln)
	}
	return strings.Replace(fmt.Sprintf("%.2f", pln), ".", ",", 1) + " zł"
}

// FormatBytes humanizes a file size for the operator STEP notification.
func FormatBytes(n int64) string {
	switch {
	case n >= 1_000_000:
		return fmt.Sprintf("%.1f MB", float64(n)/1_000_000)
	case n >= 1_000:
		return fmt.Sprintf("%.1f kB", float64(n)/1_000)
	default:
		return fmt.Sprintf("%d B", n)
	}
}
