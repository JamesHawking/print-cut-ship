package httpapi

import (
	"errors"
	"net/http"
	"regexp"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/JamesHawking/print-cut-ship/backend/internal/auth"
)

var codePattern = regexp.MustCompile(`^[0-9]{6}$`)

// RequestLoginCode emails a 6-digit login code. Always 204 — whether the
// email exists, and whether the resend throttle skipped sending — so the
// endpoint never reveals which emails exist (plan 04 amendment).
func (s *server) RequestLoginCode(w http.ResponseWriter, r *http.Request) {
	var req RequestCodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !validEmail(string(req.Email)) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	if s.cfg.Auth == nil {
		s.cfg.Logger.Warn("auth not configured; request-code no-op")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.cfg.Auth.RequestCode(r.Context(), string(req.Email)); err != nil {
		s.cfg.Logger.Error("request code failed", "err", err)
		internalError(w, "failed to send login code")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// VerifyLoginCode checks a code; on success sets the iq_session cookie.
func (s *server) VerifyLoginCode(w http.ResponseWriter, r *http.Request) {
	var req VerifyCodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !validEmail(string(req.Email)) {
		badRequest(w, InvalidEmail, "invalid email", nil)
		return
	}
	if !codePattern.MatchString(req.Code) {
		badRequest(w, InvalidBody, "code must be 6 digits", nil)
		return
	}
	if s.cfg.Auth == nil {
		s.cfg.Logger.Warn("auth not configured; verify-code unavailable")
		apiError(w, http.StatusUnauthorized, CodeInvalid, "code invalid", nil)
		return
	}
	token, _, err := s.cfg.Auth.VerifyCode(r.Context(), string(req.Email), req.Code)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrCodeInvalid):
			apiError(w, http.StatusUnauthorized, CodeInvalid, "code invalid", nil)
		case errors.Is(err, auth.ErrCodeExpired):
			apiError(w, http.StatusUnauthorized, CodeExpired, "code expired", nil)
		case errors.Is(err, auth.ErrTooManyAttempts):
			apiError(w, http.StatusUnauthorized, TooManyAttempts, "too many attempts", nil)
		default:
			s.cfg.Logger.Error("verify code failed", "err", err)
			internalError(w, "failed to verify login code")
		}
		return
	}
	setSessionCookie(w, r, token, s.cfg.Auth.SessionTTL, s.cfg.CookieSecure)
	w.WriteHeader(http.StatusNoContent)
}

// GetMe returns the session identity (frontend session restore).
func (s *server) GetMe(w http.ResponseWriter, r *http.Request) {
	u := CurrentUser(r.Context())
	if u == nil {
		apiError(w, http.StatusUnauthorized, Unauthorized, "authentication required", nil)
		return
	}
	writeJSON(w, http.StatusOK, MeResponse{
		Email: openapi_types.Email(u.Email),
		Role:  MeResponseRole(u.Role),
	})
}

// Logout deletes the session and clears the cookie. No-op without a cookie.
func (s *server) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookie); err == nil && s.cfg.Auth != nil {
		if err := s.cfg.Auth.Logout(r.Context(), cookie.Value); err != nil {
			s.cfg.Logger.Error("logout failed", "err", err)
			internalError(w, "failed to delete session")
			return
		}
	}
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}
