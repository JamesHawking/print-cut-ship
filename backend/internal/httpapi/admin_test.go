package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// adminRoutes is the auth-sweep table for the fail-closed prefix guard
// (plan 07): every admin endpoint, grown each phase. Anon must 401, a
// customer session must 403, an admin session must get past the guard
// (whatever the handler then answers).
var adminRoutes = []struct {
	method string
	path   string
}{
	{http.MethodGet, "/api/v1/admin/orders"},
	{http.MethodGet, "/api/v1/admin/orders/O-DEADBEEF"},
	{http.MethodPost, "/api/v1/admin/orders/O-DEADBEEF/refund"},
}

// makeAdmin promotes the email's user row and returns the session cookie.
func makeAdmin(t *testing.T, pool *pgxpool.Pool, session *http.Cookie, email string) *http.Cookie {
	t.Helper()
	if _, err := pool.Exec(context.Background(),
		`UPDATE users SET role = 'admin' WHERE email = $1`, email); err != nil {
		t.Fatal(err)
	}
	return session
}

func TestAdminAuthSweep(t *testing.T) {
	h, _, pool, mailer := setupOrdersTest(t)
	customer := requestCodeAndVerify(t, h, mailer, "customer@example.com")
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "boss@example.com"), "boss@example.com")

	for _, rt := range adminRoutes {
		name := rt.method + " " + rt.path
		rec := doJSON(t, h, rt.method, rt.path, "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s anon: %d, want 401", name, rec.Code)
		}
		rec = doJSONCookies(t, h, rt.method, rt.path, "", customer)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s customer: %d, want 403", name, rec.Code)
		}
		rec = doJSONCookies(t, h, rt.method, rt.path, "", admin)
		if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden {
			t.Fatalf("%s admin: %d, guard must let admins through", name, rec.Code)
		}
	}

	// Non-admin paths are untouched by the guard.
	if rec := doJSON(t, h, http.MethodGet, "/healthz", ""); rec.Code != http.StatusOK {
		t.Fatalf("healthz: %d, want 200", rec.Code)
	}
}

func TestMeResponseRole(t *testing.T) {
	h, _, pool, mailer := setupOrdersTest(t)

	customer := requestCodeAndVerify(t, h, mailer, "role-customer@example.com")
	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", customer)
	var me MeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me.Role != Customer {
		t.Fatalf("role %q, want customer", me.Role)
	}

	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "role-admin@example.com"), "role-admin@example.com")
	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", admin)
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me.Role != Admin {
		t.Fatalf("role %q, want admin", me.Role)
	}
}

func TestAdminListOrders(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "board@example.com"), "board@example.com")

	// Two orders for one customer (one paid), one draft for another.
	q1 := submitTestQuote(t, h, st, "jan@example.com")
	o1 := createTestOrder(t, h, q1, "jan@example.com", "")
	payTestOrder(t, h, o1.OrderId)
	q2 := submitTestQuote(t, h, st, "jan@example.com")
	createTestOrder(t, h, q2, "jan@example.com", "")
	q3 := submitTestQuote(t, h, st, "ala@example.com")
	createTestOrder(t, h, q3, "ala@example.com", "")

	get := func(path string) AdminListOrdersResponse {
		t.Helper()
		rec := doJSONCookies(t, h, http.MethodGet, path, "", admin)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s: %d: %s", path, rec.Code, rec.Body)
		}
		var res AdminListOrdersResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		return res
	}

	res := get("/api/v1/admin/orders")
	if res.Total != 3 || len(res.Orders) != 3 || res.Limit != 50 || res.Offset != 0 {
		t.Fatalf("board: total=%d len=%d limit=%d offset=%d", res.Total, len(res.Orders), res.Limit, res.Offset)
	}
	// The paid order carries ship-by + paidAt; drafts don't.
	var paid *AdminOrderSummary
	for i := range res.Orders {
		if res.Orders[i].OrderId == o1.OrderId {
			paid = &res.Orders[i]
		}
		if res.Orders[i].Status == Draft && res.Orders[i].ShipBy != nil {
			t.Fatalf("draft has shipBy: %+v", res.Orders[i])
		}
	}
	if paid == nil || paid.Status != Paid || paid.PaidAt == nil || paid.ShipBy == nil {
		t.Fatalf("paid order summary wrong: %+v", paid)
	}
	if paid.PartCount != 1 || paid.Email != "jan@example.com" || paid.GrossTotalPln <= 0 {
		t.Fatalf("paid order summary wrong: %+v", paid)
	}

	// Status filter.
	res = get("/api/v1/admin/orders?status=paid")
	if res.Total != 1 || len(res.Orders) != 1 || res.Orders[0].Status != Paid {
		t.Fatalf("paid filter: %+v", res)
	}

	// Pagination: 2 per page.
	res = get("/api/v1/admin/orders?limit=2&offset=2")
	if res.Total != 3 || len(res.Orders) != 1 || res.Limit != 2 || res.Offset != 2 {
		t.Fatalf("page 2: total=%d len=%d", res.Total, len(res.Orders))
	}
	// Limit clamps at 200.
	res = get("/api/v1/admin/orders?limit=9999")
	if res.Limit != 200 {
		t.Fatalf("limit clamp: %d, want 200", res.Limit)
	}
}

func TestAdminGetOrder(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "detail@example.com"), "detail@example.com")

	quoteID := submitTestQuote(t, h, st, "piotr@example.com")
	order := createTestOrder(t, h, quoteID, "piotr@example.com",
		`"companyName": "ACME sp. z o.o.", "nip": "8567346215", "invoiceRequested": true,`)
	payTestOrder(t, h, order.OrderId)

	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/orders/"+order.OrderId, "", admin)
	if rec.Code != http.StatusOK {
		t.Fatalf("detail status %d: %s", rec.Code, rec.Body)
	}
	var res AdminOrderDetail
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	o := res.Order
	if o.OrderId != order.OrderId || o.Email != "piotr@example.com" || o.Status != Paid {
		t.Fatalf("order wrong: %+v", o)
	}
	if o.Nip == nil || *o.Nip != "8567346215" || o.CompanyName == nil || !o.InvoiceRequested {
		t.Fatalf("b2b fields wrong: %+v", o)
	}
	if o.StatusToken != order.StatusToken || o.ShippingAddress.City != "Warszawa" ||
		o.Totals.GrossTotalPln <= 0 || o.PricingConfigId.String() == "" {
		t.Fatalf("order detail wrong: %+v", o)
	}
	if len(res.Items) != 1 || res.Items[0].FileName != "widget.stl" || res.Items[0].FileId == nil {
		t.Fatalf("items wrong: %+v", res.Items)
	}
	if res.Items[0].PartQuoteSnapshot == nil {
		t.Fatal("item missing partQuoteSnapshot")
	}
	if len(res.Payments) != 1 || res.Payments[0].Type != Payment ||
		res.Payments[0].Provider != "stub" {
		t.Fatalf("payments wrong: %+v", res.Payments)
	}
	if len(res.Invoices) != 0 {
		t.Fatalf("invoices %d, want 0 (seam only until plan 18)", len(res.Invoices))
	}

	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/orders/O-DEADBEEF", "", admin)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unknown order status %d, want 404", rec.Code)
	}
}

func TestAdminShipByDerivation(t *testing.T) {
	// Pinned clock: 2026-07-15 is a Wednesday (before the 14:00 cutoff), so a
	// paid order with standard (5 business days) lead time ships 2026-07-22.
	fixed := time.Date(2026, 7, 15, 10, 0, 0, 0, time.UTC)
	s := &server{cfg: Config{Now: func() time.Time { return fixed }}}

	ship := s.shipBy("paid", []string{"standard"}, timestamptz(fixed))
	if ship == nil || ship.ISO() != "2026-07-22" {
		t.Fatalf("shipBy %v, want 2026-07-22", ship)
	}
	if ship := s.shipBy("draft", []string{"standard"}, timestamptz(fixed)); ship != nil {
		t.Fatalf("draft shipBy %v, want nil", ship)
	}
	// Max over items wins: express (3) + economy (10) → economy's 10 days → 2026-07-29.
	ship = s.shipBy("paid", []string{"express", "economy"}, timestamptz(fixed))
	if ship == nil || ship.ISO() != "2026-07-29" {
		t.Fatalf("shipBy max %v, want 2026-07-29", ship)
	}
}

func TestAdminDfmFlagging(t *testing.T) {
	h, st, pool, mailer := setupOrdersTest(t)
	admin := makeAdmin(t, pool, requestCodeAndVerify(t, h, mailer, "dfm@example.com"), "dfm@example.com")

	quoteID := submitTestQuote(t, h, st, "flagged@example.com")
	order := createTestOrder(t, h, quoteID, "flagged@example.com", "")
	// Inject warn + manual_verify flags into the item snapshot (plan 02's
	// real DFM codes are severity-driven; manual_verify is forward-compat).
	ctx := context.Background()
	o, _ := st.GetOrderByShortID(ctx, order.OrderId)
	if _, err := pool.Exec(ctx, `
		UPDATE order_items
		SET part_quote_snapshot = jsonb_set(part_quote_snapshot, '{dfmFlags}',
			'[{"code": "multi_plate", "severity": "warn"},
			  {"code": "manual_verify", "severity": "info"}]')
		WHERE order_id = $1`, o.ID); err != nil {
		t.Fatal(err)
	}

	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/admin/orders", "", admin)
	var res AdminListOrdersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Orders) != 1 || !res.Orders[0].DfmFlagged || res.Orders[0].DfmCodes == nil {
		t.Fatalf("flagging wrong: %+v", res.Orders)
	}
	codes := *res.Orders[0].DfmCodes
	if fmt.Sprint(codes) != "[manual_verify multi_plate]" && fmt.Sprint(codes) != "[multi_plate manual_verify]" {
		t.Fatalf("dfm codes %v, want multi_plate + manual_verify", codes)
	}
}
