package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
)

// GenerateToken mints a 256-bit opaque session token (base64url, cookie-safe).
// Only its SHA-256 hash is stored.
func GenerateToken() (string, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", fmt.Errorf("auth: rand token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf[:]), nil
}

// HashToken returns the storage form of a session token: hex(SHA-256(token)).
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
