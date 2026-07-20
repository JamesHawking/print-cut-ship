package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// captureMailer records the codes RequestCode "sends" (console transport
// stand-in for tests).
type captureMailer struct {
	sent []struct{ email, code, locale string }
}

func (m *captureMailer) SendLoginCode(_ context.Context, email, code, locale string) error {
	m.sent = append(m.sent, struct{ email, code, locale string }{email, code, locale})
	return nil
}

// setupAuthTest builds a DB-backed server with the auth service wired, plus a
// mailer that captures codes and a raw pool for test mutations. Skips without
// TEST_DATABASE_URL.
func setupAuthTest(t *testing.T) (http.Handler, *store.Store, *pgxpool.Pool, *captureMailer) {
	t.Helper()
	st, cfgID := setupTestStore(t)
	pool, err := pgxpool.New(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE login_codes, sessions RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate auth tables: %v", err)
	}
	mailer := &captureMailer{}
	svc := auth.NewService(st, mailer, nil, 10*time.Minute, 30*24*time.Hour)
	h := testHandler(t, Config{Store: st, Pricing: testHolder(cfgID), Auth: svc}, nil)
	return h, st, pool, mailer
}

func (m *captureMailer) lastCode(t *testing.T) string {
	t.Helper()
	if len(m.sent) == 0 {
		t.Fatal("no code captured")
	}
	return m.sent[len(m.sent)-1].code
}

// requestCodeAndVerify runs the happy path and returns the session cookie.
func requestCodeAndVerify(t *testing.T, h http.Handler, m *captureMailer, email string) *http.Cookie {
	t.Helper()
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", fmt.Sprintf(`{"email": %q}`, email))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("request-code status %d: %s", rec.Code, rec.Body)
	}
	code := m.lastCode(t)
	rec = doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
		fmt.Sprintf(`{"email": %q, "code": %q}`, email, code))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("verify-code status %d: %s", rec.Code, rec.Body)
	}
	var session *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie {
			session = c
		}
	}
	if session == nil {
		t.Fatal("no session cookie set")
	}
	if !session.HttpOnly || session.SameSite != http.SameSiteLaxMode || session.Path != "/" {
		t.Fatalf("cookie flags wrong: %+v", session)
	}
	return session
}

func doJSONCookies(t *testing.T, h http.Handler, method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAuthHappyPath(t *testing.T) {
	h, _, _, mailer := setupAuthTest(t)
	email := "jan@example.com"
	session := requestCodeAndVerify(t, h, mailer, email)

	// me resolves the session.
	rec := doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", session)
	if rec.Code != http.StatusOK {
		t.Fatalf("me status %d: %s", rec.Code, rec.Body)
	}
	var me MeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if string(me.Email) != email {
		t.Fatalf("me email %q, want %q", me.Email, email)
	}

	// logout kills the session.
	rec = doJSONCookies(t, h, http.MethodPost, "/api/v1/auth/logout", "", session)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("logout status %d: %s", rec.Code, rec.Body)
	}
	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", session)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("me after logout status %d, want 401", rec.Code)
	}
}

func TestAuthRequestCodeUniform204(t *testing.T) {
	h, _, _, _ := setupAuthTest(t)
	// Unknown email: still 204 (no user enumeration).
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", `{"email": "ghost@example.com"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("unknown email status %d, want 204", rec.Code)
	}
	// Malformed email: the only 400. The generated Email type rejects it at
	// decode time with invalid_body (same as the quote endpoints).
	rec = doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", `{"email": "nope"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("malformed email status %d, want 400", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != InvalidBody {
		t.Fatalf("code %q, want invalid_body", e.Code)
	}
	// No users row is created by a bare request (emailNote promise).
	rec = doJSON(t, h, http.MethodGet, "/api/v1/auth/me", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("me without session status %d, want 401", rec.Code)
	}
}

func TestAuthWrongAndReusedCode(t *testing.T) {
	h, _, _, mailer := setupAuthTest(t)
	email := "piotr@example.com"
	doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", fmt.Sprintf(`{"email": %q}`, email))
	code := mailer.lastCode(t)

	wrong := "000000"
	if code == wrong {
		wrong = "111111"
	}
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
		fmt.Sprintf(`{"email": %q, "code": %q}`, email, wrong))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong code status %d, want 401", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != CodeInvalid {
		t.Fatalf("code %q, want code_invalid", e.Code)
	}

	// Right code works once...
	session := requestCodeAndVerifyReusing(t, h, email, code)
	_ = session
	// ...and is single-use: replaying it fails uniformly.
	rec = doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
		fmt.Sprintf(`{"email": %q, "code": %q}`, email, code))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("reused code status %d, want 401", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != CodeInvalid {
		t.Fatalf("reused code error %q, want code_invalid", e.Code)
	}
}

// requestCodeAndVerifyReusing verifies an already-issued code.
func requestCodeAndVerifyReusing(t *testing.T, h http.Handler, email, code string) *http.Cookie {
	t.Helper()
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
		fmt.Sprintf(`{"email": %q, "code": %q}`, email, code))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("verify-code status %d: %s", rec.Code, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie {
			return c
		}
	}
	t.Fatal("no session cookie set")
	return nil
}

func TestAuthAttemptCap(t *testing.T) {
	h, _, _, mailer := setupAuthTest(t)
	email := "ania@example.com"
	doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", fmt.Sprintf(`{"email": %q}`, email))
	code := mailer.lastCode(t)
	wrong := "999999"
	if code == wrong {
		wrong = "888888"
	}

	verify := func() (int, ApiErrorCode) {
		rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
			fmt.Sprintf(`{"email": %q, "code": %q}`, email, wrong))
		var e ApiError
		_ = json.Unmarshal(rec.Body.Bytes(), &e)
		return rec.Code, e.Code
	}

	// Attempts 1-4: plain invalid.
	for i := 1; i <= 4; i++ {
		status, codeErr := verify()
		if status != http.StatusUnauthorized || codeErr != CodeInvalid {
			t.Fatalf("attempt %d: status %d code %q, want 401 code_invalid", i, status, codeErr)
		}
	}
	// 5th wrong attempt hits the cap and consumes the code.
	status, codeErr := verify()
	if status != http.StatusUnauthorized || codeErr != TooManyAttempts {
		t.Fatalf("attempt 5: status %d code %q, want 401 too_many_attempts", status, codeErr)
	}
	// Even the RIGHT code is dead now.
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
		fmt.Sprintf(`{"email": %q, "code": %q}`, email, code))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("right code after cap status %d, want 401", rec.Code)
	}
}

func TestAuthExpiredCode(t *testing.T) {
	h, st, pool, mailer := setupAuthTest(t)
	email := "kasia@example.com"
	doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", fmt.Sprintf(`{"email": %q}`, email))
	code := mailer.lastCode(t)

	// Force expiry.
	lc, err := st.GetLatestLoginCode(context.Background(), email)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(),
		`UPDATE login_codes SET expires_at = $1 WHERE id = $2`,
		time.Now().Add(-time.Minute), lc.ID); err != nil {
		t.Fatal(err)
	}

	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/verify-code",
		fmt.Sprintf(`{"email": %q, "code": %q}`, email, code))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expired code status %d, want 401", rec.Code)
	}
	var e ApiError
	_ = json.Unmarshal(rec.Body.Bytes(), &e)
	if e.Code != CodeExpired {
		t.Fatalf("code %q, want code_expired", e.Code)
	}
}

func TestAuthResendThrottle(t *testing.T) {
	h, _, _, mailer := setupAuthTest(t)
	email := "tomek@example.com"
	body := fmt.Sprintf(`{"email": %q}`, email)

	doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", body)
	if len(mailer.sent) != 1 {
		t.Fatalf("sent %d, want 1", len(mailer.sent))
	}
	// Immediate resend: 204 but silently skipped (< 30s).
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", body)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("resend status %d, want 204", rec.Code)
	}
	if len(mailer.sent) != 1 {
		t.Fatalf("sent after fast resend %d, want 1 (throttled)", len(mailer.sent))
	}
}

func TestAuthHourlyCap(t *testing.T) {
	h, st, _, mailer := setupAuthTest(t)
	email := "ela@example.com"
	body := fmt.Sprintf(`{"email": %q}`, email)

	// Backdate 5 codes to just inside the hourly window.
	for i := 0; i < 5; i++ {
		if _, err := st.CreateLoginCode(context.Background(), store.CreateLoginCodeParams{
			Email:     email,
			CodeHash:  auth.HashCode(fmt.Sprintf("%06d", i)),
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(time.Hour), Valid: true},
		}); err != nil {
			t.Fatal(err)
		}
	}
	rec := doJSON(t, h, http.MethodPost, "/api/v1/auth/request-code", body)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d, want 204", rec.Code)
	}
	if len(mailer.sent) != 0 {
		t.Fatalf("sent %d codes past the hourly cap, want 0", len(mailer.sent))
	}
}

// TestSessionMiddleware covers no cookie / garbage / expired / valid /
// admin-vs-customer on a guarded route.
func TestSessionMiddleware(t *testing.T) {
	h, st, pool, mailer := setupAuthTest(t)
	ctx := context.Background()

	guarded := func(cookies ...*http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		return doJSONCookies(t, h, http.MethodGet, "/api/v1/auth/me", "", cookies...)
	}

	t.Run("no cookie", func(t *testing.T) {
		if rec := guarded(); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("garbage cookie", func(t *testing.T) {
		rec := guarded(&http.Cookie{Name: sessionCookie, Value: "garbage"})
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("expired session", func(t *testing.T) {
		session := requestCodeAndVerify(t, h, mailer, "old@example.com")
		if _, err := pool.Exec(ctx,
			`UPDATE sessions SET expires_at = $1 WHERE token_hash = $2`,
			time.Now().Add(-time.Minute), auth.HashToken(session.Value)); err != nil {
			t.Fatal(err)
		}
		rec := guarded(session)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("valid session", func(t *testing.T) {
		session := requestCodeAndVerify(t, h, mailer, "new@example.com")
		rec := guarded(session)
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d, want 200", rec.Code)
		}
	})

	t.Run("sliding refresh", func(t *testing.T) {
		session := requestCodeAndVerify(t, h, mailer, "slide@example.com")
		// Age the session past the refresh throttle.
		if _, err := pool.Exec(ctx,
			`UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2`,
			time.Now().Add(-2*time.Hour), auth.HashToken(session.Value)); err != nil {
			t.Fatal(err)
		}
		rec := guarded(session)
		if rec.Code != http.StatusOK {
			t.Fatalf("status %d, want 200", rec.Code)
		}
		row, err := st.GetSessionByTokenHash(ctx, auth.HashToken(session.Value))
		if err != nil {
			t.Fatal(err)
		}
		if time.Since(row.LastSeenAt.Time) > time.Minute {
			t.Fatalf("last_seen_at not refreshed: %v", row.LastSeenAt.Time)
		}
		if row.ExpiresAt.Time.Before(time.Now().Add(29 * 24 * time.Hour)) {
			t.Fatalf("expires_at not extended: %v", row.ExpiresAt.Time)
		}
	})
}

// TestRequireAdmin exercises the guard plan 07 will mount.
func TestRequireAdmin(t *testing.T) {
	h, st, pool, mailer := setupAuthTest(t)
	ctx := context.Background()

	// Mount a throwaway admin route behind both guards.
	s := &server{cfg: Config{Store: st, Auth: auth.NewService(st, mailer, nil, 10*time.Minute, 30*24*time.Hour)}}
	admin := s.sessionMiddleware(RequireAdmin(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})))

	call := func(cookies ...*http.Cookie) int {
		req := httptest.NewRequest(http.MethodGet, "/admin", nil)
		for _, c := range cookies {
			req.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		admin.ServeHTTP(rec, req)
		return rec.Code
	}

	if got := call(); got != http.StatusUnauthorized {
		t.Fatalf("anonymous: %d, want 401", got)
	}

	customer := requestCodeAndVerify(t, h, mailer, "customer@example.com")
	if got := call(customer); got != http.StatusForbidden {
		t.Fatalf("customer: %d, want 403", got)
	}

	adminSession := requestCodeAndVerify(t, h, mailer, "admin@example.com")
	if _, err := pool.Exec(ctx,
		`UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`); err != nil {
		t.Fatal(err)
	}
	if got := call(adminSession); got != http.StatusNoContent {
		t.Fatalf("admin: %d, want 204", got)
	}
}

// TestListOrdersRequiresSession pins the 401 + session-derived email.
func TestListOrdersRequiresSession(t *testing.T) {
	h, _, _, mailer := setupAuthTest(t)

	rec := doJSON(t, h, http.MethodGet, "/api/v1/orders", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status %d, want 401", rec.Code)
	}

	session := requestCodeAndVerify(t, h, mailer, "orders@example.com")
	rec = doJSONCookies(t, h, http.MethodGet, "/api/v1/orders", "", session)
	if rec.Code != http.StatusOK {
		t.Fatalf("signed-in status %d: %s", rec.Code, rec.Body)
	}
	var res ListOrdersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if len(res.Orders) != 0 {
		t.Fatalf("orders %d, want 0 for a fresh account", len(res.Orders))
	}
}

// TestAuthSessionSurvivesRestart simulates a backend restart: a new service
// instance over the same DB still resolves the session (Postgres-backed).
func TestAuthSessionSurvivesRestart(t *testing.T) {
	h, st, _, mailer := setupAuthTest(t)
	session := requestCodeAndVerify(t, h, mailer, "restart@example.com")

	// "Restart": fresh handler + service, same DB.
	svc2 := auth.NewService(st, mailer, nil, 10*time.Minute, 30*24*time.Hour)
	h2 := testHandler(t, Config{Store: st, Auth: svc2}, nil)

	rec := doJSONCookies(t, h2, http.MethodGet, "/api/v1/auth/me", "", session)
	if rec.Code != http.StatusOK {
		t.Fatalf("me after restart status %d, want 200", rec.Code)
	}
	var me MeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if string(me.Email) != "restart@example.com" {
		t.Fatalf("email %q", me.Email)
	}
}

func TestGenerateCodeFormat(t *testing.T) {
	for i := 0; i < 1000; i++ {
		code, err := auth.GenerateCode()
		if err != nil {
			t.Fatal(err)
		}
		if !codePattern.MatchString(code) {
			t.Fatalf("code %q not 6 digits", code)
		}
	}
	if len(auth.HashCode("123456")) != 64 {
		t.Fatal("hash not sha256 hex")
	}
	if len(auth.HashToken("x")) != 64 {
		t.Fatal("token hash not sha256 hex")
	}
	if !strings.EqualFold(auth.HashCode("123456"), auth.HashCode("123456")) {
		t.Fatal("hash not deterministic")
	}
}
