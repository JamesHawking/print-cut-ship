package email

import (
	"strings"
	"testing"
)

// Template goldens: every embedded template × locale must execute with
// fixture data and produce localized copy + the support footer line. These
// pin the React-source → Go-artifact pre-render chain (build-emails.ts).
func TestTemplateGoldens(t *testing.T) {
	fixtures := []struct {
		name     string
		tmpl     Template
		data     any
		contains map[string][]string // locale → strings that must appear
	}{
		{
			name: "login code",
			tmpl: LoginCode,
			data: LoginCodeData{Code: "123456"},
			contains: map[string][]string{
				"pl": {"123456", "10 minut", "Odpisz po prostu"},
				"en": {"123456", "10 minutes", "reply to this email"},
			},
		},
		{
			name: "order confirmation",
			tmpl: OrderConfirmation,
			data: fixtureOrderData(),
			contains: map[string][]string{
				"pl": {"O-AB12CD34", "wspornik.stl", "86,10 zł", "123,00 zł",
					"http://test.local/pl/order/tok123"},
				// Money arrives preformatted by the caller — the template
				// renders whatever string the data carries.
				"en": {"O-AB12CD34", "wspornik.stl", "86,10 zł", "123,00 zł",
					"http://test.local/pl/order/tok123"},
			},
		},
		{
			name: "payment receipt",
			tmpl: PaymentReceipt,
			data: fixtureOrderData(),
			contains: map[string][]string{
				"pl": {"Mamy twoją płatność", "123,00 zł"},
				"en": {"Payment received", "123,00 zł"},
			},
		},
		{
			name: "shipped",
			tmpl: Shipped,
			data: ShippedData{OrderShortID: "O-AB12CD34", TrackingNumber: "DHL-123", StatusURL: "http://test.local/pl/order/tok123"},
			contains: map[string][]string{
				"pl": {"Paczka w drodze", "DHL-123"},
				"en": {"on its way", "DHL-123"},
			},
		},
		{
			name: "step ack",
			tmpl: StepAck,
			data: StepAckData{FileName: "korpus.step"},
			contains: map[string][]string{
				"pl": {"korpus.step", "4 godzin roboczych"},
				"en": {"korpus.step", "4 working hours"},
			},
		},
		{
			name: "step notify (pl only, en falls back)",
			tmpl: StepNotify,
			data: StepNotifyData{RequestID: "STEP-1A2B3C4D", Email: "jan@example.com", FileName: "korpus.step", FileSize: "2,4 MB"},
			contains: map[string][]string{
				"pl": {"STEP-1A2B3C4D", "jan@example.com", "2,4 MB"},
				"en": {"STEP-1A2B3C4D", "jan@example.com"}, // pl fallback
			},
		},
	}
	for _, f := range fixtures {
		for _, locale := range []string{"pl", "en"} {
			subject, page, err := Render(f.tmpl, locale, f.data)
			if err != nil {
				t.Errorf("%s/%s render: %v", f.name, locale, err)
				continue
			}
			if subject == "" || page == "" {
				t.Errorf("%s/%s: empty subject/body", f.name, locale)
			}
			for _, want := range f.contains[locale] {
				if !strings.Contains(page, want) {
					t.Errorf("%s/%s body missing %q", f.name, locale, want)
				}
			}
			if !strings.Contains(page, "MICRO_FACTORY") {
				t.Errorf("%s/%s body missing wordmark", f.name, locale)
			}
		}
	}
}

// Subjects are text/templates with the same placeholders.
func TestSubjectInterpolation(t *testing.T) {
	subject, _, err := Render(OrderConfirmation, "pl", fixtureOrderData())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(subject, "O-AB12CD34") || strings.Contains(subject, "{{") {
		t.Errorf("subject not interpolated: %q", subject)
	}
}

// Unknown locales fall back to pl.
func TestLocaleFallback(t *testing.T) {
	_, page, err := Render(LoginCode, "de", LoginCodeData{Code: "654321"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(page, "jednorazowy kod") {
		t.Errorf("de did not fall back to pl")
	}
}

// The status_change template branches on NewStatus via Go conditionals.
func TestStatusChangeVariants(t *testing.T) {
	for status, want := range map[string]string{
		"in_production": "w produkcji",
		"delivered":     "dostarczone",
		"cancelled":     "anulowane",
		"refunded":      "Zwrot",
	} {
		_, page, err := Render(StatusChange, "pl", StatusChangeData{
			OrderShortID: "O-AB12CD34", NewStatus: status, StatusURL: "http://x",
		})
		if err != nil {
			t.Fatalf("%s: %v", status, err)
		}
		if !strings.Contains(page, want) {
			t.Errorf("status %q body missing %q", status, want)
		}
	}
}

func fixtureOrderData() OrderData {
	return OrderData{
		OrderShortID: "O-AB12CD34",
		GrossTotal:   FormatPLN(12300, "pl"),
		StatusURL:    "http://test.local/pl/order/tok123",
		Items: []OrderItemData{
			{FileName: "wspornik.stl", Quantity: 2, LineTotal: FormatPLN(8610, "pl")},
		},
	}
}

func TestFormatPLN(t *testing.T) {
	if got := FormatPLN(12300, "pl"); got != "123,00 zł" {
		t.Errorf("pl: %q", got)
	}
	if got := FormatPLN(8610, "en"); got != "86.10 PLN" {
		t.Errorf("en: %q", got)
	}
}
