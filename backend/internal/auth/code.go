// Package auth implements the passwordless OTP flow (plan 04, amended
// 2026-07-18): 6-digit one-time codes over email and opaque session tokens,
// both stored SHA-256-hashed in Postgres.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
)

// codeSpace is the number of possible 6-digit codes.
const codeSpace = 1_000_000

// GenerateCode mints a uniformly random 6-digit code (rejection-sampled to
// avoid modulo bias).
func GenerateCode() (string, error) {
	// Largest multiple of codeSpace representable in a uint32.
	limit := (1 << 32) - ((1 << 32) % codeSpace)
	var buf [4]byte
	for {
		if _, err := rand.Read(buf[:]); err != nil {
			return "", fmt.Errorf("auth: rand code: %w", err)
		}
		v := binary.BigEndian.Uint32(buf[:])
		if v < uint32(limit) {
			return fmt.Sprintf("%06d", v%codeSpace), nil
		}
	}
}

// HashCode returns the storage form of a code: hex(SHA-256(code)).
func HashCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}
