# 11 — Observability, error tracking & analytics

## 1. Context

Today the shop would fail silently. `instant-quote/src/lib/funnel.ts` emits a complete, PostHog-shaped event taxonomy (`upload_started`, `parse_succeeded`, `quote_shown`, `config_changed`, `order_clicked`, `order_submitted`…) — **to the console only**. `vite.config.ts` marks Sentry external but no SDK is wired. The Go backend logs to stdout with no aggregation, no error tracker, no uptime monitor, and no alerting. Once money flows (plan 05), a broken webhook or a dead Bambu token must page someone before a customer notices.

Treat as a launch gate: launching blind is a bad idea.

## 2. Decisions applied

**Pinned (DECISIONS.md):** Sentry SaaS (external to the monitored box — deliberate; self-hosting monitoring on the monitored host is circular); PostHog EU Cloud, cookieless (consent posture per plan 09: no banner needed); release tagging from plan 03's CI.

**Topic-local decisions:**

- **One Sentry org, two projects** (`iq-frontend`, `iq-backend`) sharing the release SHA — cross-service traces of one deploy under one release tag.
- **Server-side capture for money events.** Client PostHog can be blocked; `order_paid` (webhook) and `order_created` are captured **from Go** via PostHog's HTTP API so revenue analytics never depend on the browser. Client keeps the funnel UX events.
- **Structured logs = `log/slog` JSON to stdout**, aggregated by the host (Coolify/Docker logs at launch — queryable via `docker logs`/Coolify UI; a Loki-style stack is deliberate over-engineering at one host). Retention = Docker log rotation config (plan 03).
- **Uptime = external SaaS pinger** (UptimeRobot/Better Stack free tier) on `/health` (frontend) + `/healthz` (backend via `/api` path) — must live outside the Coolify host by definition.

## 3. Implementation phases

### Phase A — Sentry, both services

- **Backend:** `sentry-go` in `cmd/api/main.go` (DSN from env, `release` from the ldflags SHA — plan 03), chi middleware for panic capture + request context; `slog` errors ≥ `Error` become breadcrumbs/events. Scrub PII (email) from event payloads by default.
- **Frontend:** `@sentry/react` init in the root route (DSN public var, `release = VITE_SENTRY_RELEASE`), sourcemap upload step in the deploy workflow (`sentry-cli` — fills the placeholder plan 03 left), error boundary around the quote workspace so a viewer crash reports and degrades instead of white-screening.
- **Verify:** a deliberate test error thrown in each service appears in the right Sentry project tagged with the current release + request/user context; frontend stack traces are de-minified.

### Phase B — PostHog wired for real

- Frontend: `posthog-js` in cookieless mode (`persistence: 'memory'`, no consent banner per plan 09), EU host; `funnel.ts`'s `track()` forwards to `posthog.capture()` keeping the existing event names — the taxonomy is already designed.
- Backend: minimal HTTP capture client (`internal/analytics`) for `order_created`, `order_paid`, `order_refunded` (distinct id = order shortId — no PII), called from plan 05's handlers/webhook.
- Funnels + dashboard in PostHog: upload → quote_shown → order_clicked → order_created → order_paid; tiles for quotes/day, conversion %, AOV (from the grosze totals sent as event properties).
- **Verify:** driving the quote flow on staging shows the event stream live in PostHog; a test-mode payment produces `order_paid` with the right amount; the dashboard tiles populate.

### Phase C — Logging + uptime + alerting

- `slog` JSON everywhere in Go (replace any `log.Printf`), request-id middleware (id also returned as a response header for support correlation), key fields standardized (`order_short_id`, `route`, `duration_ms`).
- External uptime checks on both health endpoints + the production domain root; alert → email/phone push.
- **Alert rules:** Sentry — new-issue + error-rate spike per project; PostHog/cron — `api bambu-token-check` failure (plan 10) exits non-zero → Coolify task failure notification; **webhook failure** — Sentry alert on any error in the Stripe webhook handler (highest-value alert in the system) + a daily `api unpaid-drafts-report` style check (optional) for silent gaps.
- **Verify:** stopping the backend container pages within minutes via the uptime service; a forced webhook exception triggers the Sentry alert; a forced token-check failure surfaces in Coolify notifications.

## 4. Dependencies

- **Requires:** 03 (health endpoints, release SHAs in CI/deploy, env plumbing, task runner). Consumes events from 05 (money events) and 10 (token check).
- **Blocks:** nothing hard — but treated as a **launch gate**.
- **Coordinates:** 09 (cookieless posture documented in the privacy policy; processor list includes PostHog + Sentry), 06 (failed-send `email_log` rows — add a Sentry breadcrumb on `status='failed'`).

## 5. Verification

- [ ] A thrown test error appears in the tracker with release + context from **both** services; frontend traces de-minified.
- [ ] Funnel events flow to a real PostHog dashboard; `order_paid` captured server-side even with client analytics blocked (verify with an adblocking browser).
- [ ] Downtime pages within minutes (uptime service on both endpoints).
- [ ] Stripe-webhook error alert fires on a forced failure.
- [ ] Bambu token-check failure surfaces as an alert.
- [ ] No PII in analytics events (spot-check payloads); Sentry scrubbing confirmed.
- [ ] Business dashboard shows quotes/day, conversion, AOV against staging test data.

## 6. Risks & open questions

- **Cookieless PostHog identity:** memory persistence means a returning visitor is a new distinct id — funnel steps within one session are fine (the product is single-session by design), but cross-session attribution is lost. Accepted; revisit only with a consent banner.
- **Sentry free-tier quotas:** error spikes (e.g. a broken deploy) can burn the quota; set rate limits per project in Sentry settings.
- **Alert fatigue vs one operator:** start with the four alerts above only (uptime, webhook, token, error-spike). Resist adding more until one fires uselessly twice.
- **Open:** session replay (PostHog) is tempting for quote-flow UX debugging but has PII/consent implications — leave off at launch, decide with plan 09 if ever enabled.
