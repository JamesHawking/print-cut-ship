package auth

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JamesHawking/print-cut-ship/backend/internal/email"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// Verify failures, mapped to machine codes by the HTTP layer.
var (
	ErrCodeInvalid     = errors.New("auth: code invalid")
	ErrCodeExpired     = errors.New("auth: code expired")
	ErrTooManyAttempts = errors.New("auth: too many attempts")
)

// Per-email caps — the floor against brute force on the small 6-digit space
// (IP-level limits are plan 10).
const (
	MaxAttempts       = 5
	ResendMinInterval = 30 * time.Second
	MaxCodesPerHour   = 5
)

// User is the identity a verified session resolves to.
type User struct {
	ID    uuid.UUID
	Email string
	Role  string
}

// Service orchestrates the OTP login flow over the store.
type Service struct {
	Store      *store.Store
	Mailer     email.Sender
	Logger     *slog.Logger
	CodeTTL    time.Duration // default 10 min (matches UI copy)
	SessionTTL time.Duration // default 30 days, sliding
	// now is overridable in tests.
	now func() time.Time
}

func NewService(st *store.Store, mailer email.Sender, logger *slog.Logger, codeTTL, sessionTTL time.Duration) *Service {
	if logger == nil {
		logger = slog.Default()
	}
	if codeTTL <= 0 {
		codeTTL = 10 * time.Minute
	}
	if sessionTTL <= 0 {
		sessionTTL = 30 * 24 * time.Hour
	}
	return &Service{
		Store: st, Mailer: mailer, Logger: logger,
		CodeTTL: codeTTL, SessionTTL: sessionTTL,
		now: time.Now,
	}
}

// RequestCode mints and emails a fresh login code, invalidating any prior
// codes for the email. Throttled requests (resend < 30s, > 5/hour) are
// silently skipped — the HTTP layer answers 204 regardless, so the endpoint
// never reveals which emails exist or whether a send happened. The locale
// selects the email template language (plan 06).
func (s *Service) RequestCode(ctx context.Context, addr, locale string) error {
	// Opportunistic sweep (plan 03's job runner gets the real schedule).
	if err := s.Store.DeleteExpiredLoginCodes(ctx); err != nil {
		s.Logger.Warn("auth: sweep login codes failed", "err", err)
	}

	since := s.now().Add(-time.Hour)
	count, err := s.Store.CountRecentLoginCodesForEmail(ctx, store.CountRecentLoginCodesForEmailParams{
		Email: addr, CreatedAt: pgtype.Timestamptz{Time: since, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("auth: count recent codes: %w", err)
	}
	if count >= MaxCodesPerHour {
		s.Logger.Info("auth: hourly code cap reached; skipping send", "email", addr)
		return nil
	}
	recent, err := s.Store.CountRecentLoginCodesForEmail(ctx, store.CountRecentLoginCodesForEmailParams{
		Email: addr, CreatedAt: pgtype.Timestamptz{Time: s.now().Add(-ResendMinInterval), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("auth: count recent codes: %w", err)
	}
	if recent > 0 {
		s.Logger.Info("auth: resend too soon; skipping send", "email", addr)
		return nil
	}

	if err := s.Store.InvalidateLoginCodesForEmail(ctx, addr); err != nil {
		return fmt.Errorf("auth: invalidate prior codes: %w", err)
	}
	code, err := GenerateCode()
	if err != nil {
		return err
	}
	if _, err := s.Store.CreateLoginCode(ctx, store.CreateLoginCodeParams{
		Email:     addr,
		CodeHash:  HashCode(code),
		ExpiresAt: pgtype.Timestamptz{Time: s.now().Add(s.CodeTTL), Valid: true},
	}); err != nil {
		return fmt.Errorf("auth: create code: %w", err)
	}
	if err := s.Mailer.SendLoginCode(ctx, addr, code, locale); err != nil {
		return fmt.Errorf("auth: send code: %w", err)
	}
	return nil
}

// VerifyCode checks a code and, on success, upserts the user (the identity
// anchor — no users row exists before a first successful verify) and opens a
// session, returning the raw session token (cookie value) and the user.
// Codes are single-use and allow MaxAttempts wrong guesses before being
// consumed.
func (s *Service) VerifyCode(ctx context.Context, addr, code string) (string, User, error) {
	lc, err := s.Store.GetLatestLoginCode(ctx, addr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", User{}, ErrCodeInvalid
		}
		return "", User{}, fmt.Errorf("auth: load code: %w", err)
	}

	if lc.Attempts >= MaxAttempts {
		_ = s.Store.ConsumeLoginCode(ctx, lc.ID)
		return "", User{}, ErrTooManyAttempts
	}
	if !lc.ExpiresAt.Time.After(s.now()) {
		_ = s.Store.ConsumeLoginCode(ctx, lc.ID)
		return "", User{}, ErrCodeExpired
	}

	got := HashCode(code)
	if subtle.ConstantTimeCompare([]byte(got), []byte(lc.CodeHash)) != 1 {
		if err := s.Store.BumpLoginCodeAttempts(ctx, lc.ID); err != nil {
			return "", User{}, fmt.Errorf("auth: bump attempts: %w", err)
		}
		if lc.Attempts+1 >= MaxAttempts {
			_ = s.Store.ConsumeLoginCode(ctx, lc.ID)
			return "", User{}, ErrTooManyAttempts
		}
		return "", User{}, ErrCodeInvalid
	}

	if err := s.Store.ConsumeLoginCode(ctx, lc.ID); err != nil {
		return "", User{}, fmt.Errorf("auth: consume code: %w", err)
	}
	u, err := s.Store.UpsertUserByEmail(ctx, addr)
	if err != nil {
		return "", User{}, fmt.Errorf("auth: upsert user: %w", err)
	}
	token, err := GenerateToken()
	if err != nil {
		return "", User{}, err
	}
	if _, err := s.Store.CreateSession(ctx, store.CreateSessionParams{
		UserID:    u.ID,
		TokenHash: HashToken(token),
		ExpiresAt: pgtype.Timestamptz{Time: s.now().Add(s.SessionTTL), Valid: true},
	}); err != nil {
		return "", User{}, fmt.Errorf("auth: create session: %w", err)
	}
	// Opportunistic sweep.
	if err := s.Store.DeleteExpiredSessions(ctx); err != nil {
		s.Logger.Warn("auth: sweep sessions failed", "err", err)
	}
	return token, User{ID: u.ID, Email: addr, Role: u.Role}, nil
}

// Logout deletes the session for a raw token. Unknown tokens are a no-op.
func (s *Service) Logout(ctx context.Context, token string) error {
	if err := s.Store.DeleteSessionByTokenHash(ctx, HashToken(token)); err != nil {
		return fmt.Errorf("auth: delete session: %w", err)
	}
	return nil
}
