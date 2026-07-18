package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// sessionCookie is the plan-04 cookie name; httpOnly + SameSite=Lax + Path=/,
// Secure on TLS or when COOKIE_SECURE=true.
const sessionCookie = "iq_session"

// sessionRefreshInterval throttles the sliding-TTL refresh (DB write +
// cookie re-set) to ~1/hour.
const sessionRefreshInterval = time.Hour

type ctxKey int

const ctxUser ctxKey = iota

// CurrentUser returns the session identity attached by the session
// middleware, or nil.
func CurrentUser(ctx context.Context) *auth.User {
	u, _ := ctx.Value(ctxUser).(*auth.User)
	return u
}

// sessionMiddleware resolves the iq_session cookie to a user in the request
// context. Cheap when no cookie is present; unknown/expired sessions are
// simply anonymous. Mounted globally; guards live on the routes that need
// them (quoting stays anonymous).
func (s *server) sessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil || s.cfg.Auth == nil {
			next.ServeHTTP(w, r)
			return
		}
		row, err := s.cfg.Auth.Store.GetSessionByTokenHash(r.Context(), auth.HashToken(cookie.Value))
		if err != nil {
			if err != pgx.ErrNoRows {
				s.cfg.Logger.Warn("session lookup failed", "err", err)
			}
			next.ServeHTTP(w, r)
			return
		}
		user := &auth.User{ID: row.UserID, Email: row.Email, Role: row.Role}

		// Sliding refresh, throttled to ~1/hour.
		if time.Since(row.LastSeenAt.Time) > sessionRefreshInterval {
			expires := time.Now().Add(s.cfg.Auth.SessionTTL)
			params := store.TouchSessionParams{
				ID:        row.SessionID,
				ExpiresAt: pgtype.Timestamptz{Time: expires, Valid: true},
			}
			if err := s.cfg.Auth.Store.TouchSession(r.Context(), params); err != nil {
				s.cfg.Logger.Warn("session touch failed", "err", err)
			} else {
				setSessionCookie(w, r, cookie.Value, s.cfg.Auth.SessionTTL, s.cfg.CookieSecure)
			}
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxUser, user)))
	})
}

// RequireUser guards a route: 401 with the machine-code envelope when no
// valid session is present.
func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if CurrentUser(r.Context()) == nil {
			apiError(w, http.StatusUnauthorized, Unauthorized, "authentication required", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAdmin guards a route: 401 anonymous, 403 non-admin. Ships tested but
// unmounted — plan 07 mounts it on /api/v1/admin/*.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := CurrentUser(r.Context())
		if u == nil {
			apiError(w, http.StatusUnauthorized, Unauthorized, "authentication required", nil)
			return
		}
		if u.Role != "admin" {
			apiError(w, http.StatusForbidden, Unauthorized, "admin role required", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// setSessionCookie writes the session cookie. Secure on TLS requests or when
// COOKIE_SECURE=true (dev over plain http keeps it off).
func setSessionCookie(w http.ResponseWriter, r *http.Request, token string, ttl time.Duration, forceSecure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   forceSecure || r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttl.Seconds()),
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
