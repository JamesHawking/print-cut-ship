// Signed-in email for the prototype order-access flow (/login → /orders).
// Session-scoped on purpose: closing the tab signs out. There is no token —
// the one-time code is simulated and GET /api/v1/orders is unauthenticated
// until plan 05 adds real auth.

const KEY = 'iq.orderAccessEmail'

export function getSessionEmail(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setSessionEmail(email: string): void {
  try {
    sessionStorage.setItem(KEY, email)
  } catch {
    // Storage unavailable (private mode) — login just won't persist.
  }
}

export function clearSessionEmail(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
