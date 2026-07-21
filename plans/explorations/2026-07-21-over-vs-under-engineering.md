# Over- vs under-engineering audit — 2026-07-21

Point-in-time exploration, not a tracked plan. Evidence: three parallel
codebase/history scans plus first-hand verification of each headline claim.
Frame: repo is 8 days old (2026-07-14 → 07-21, 158 commits),
pre-incorporation, not deployed, no domain, cannot take money.

## Most over-engineered: the quote-editor "desktop shell"

`instant-quote/src/components/quote-editor/` — 1,543 lines across 12 files
(plus ~105 lines of camera-preset/shortcut libs) building a Blender-style IDE
(outliner, viewport toolbar, inspector, top bar, status strip, share menu,
camera presets, keyboard shortcuts) on top of a 4-field form — file, material,
quantity, lead time — for a shop whose baskets sit near the 30 zł minimum.
It is a parallel implementation: the simpler two-column layout handles
identical state, serves mobile, and desktop toggles back via
`Edytor | Uproszczony` (`quote.tsx`). Every quote-flow UI change is now built
and QA'd twice — with zero component tests covering either path.

Fossils of the same habit:

- `FactoryScene.tsx` + `FactoryHero.tsx` = 831 lines of dead
  react-three-fiber (6-DoF arm, per-frame analytic 2-link IK, keyframe
  sampler, procedural gears, conveyor) — zero render sites repo-wide;
  already advisor-flagged for deletion.
- `Hero.tsx` — ~380 of 516 lines are a decorative courier drone with two
  hand-rolled damped-spring integrators; its own comment says "pure
  decoration."

The habit, from git (07-15 → 07-20): polish bucket
(hero/drone/landing/editor/design/blog) = 49 commits, +33,808 lines;
commerce bucket (orders/checkout/auth/email/pay) = 22 commits, +12,008 lines;
real payment rail (Stripe + Fakturownia, plan 18) = 0 lines. Most-churned
files are i18n copy and presentation components (pl.ts 52 commits,
SiteHeader 24, quote.tsx 17).

Backend note: `internal/payments` (341 lines of Stripe-shaped event pipeline
whose only provider is a stub) looks over-engineered but is deliberate
plan-18 seam-building; not the winner.

## Most under-engineered: the go-live last mile (deploy + telemetry)

The product exists only on localhost, and it is blind:

- Plan 03 (deploy/CI): not started. No CI config, no Coolify config,
  `PUBLIC_BASE_URL` defaults to `localhost:3000`. Dockerfile + compose
  already exist — remaining work ≈ 1–2 days.
- `src/lib/funnel.ts`: 19 typed funnel events wired through ~25 call sites,
  ending at `console.info('[funnel]', payload)` (line 50). The file is
  written as a PostHog drop-in ("replace the body of `track()`") that was
  never filled. Sentry = two `TODO(plan 11)` comments. Zero funnel data has
  ever been collected.
- Everything gated on a URL is stalled with it: the ~15.8k-line blog + SEO
  pages earn zero indexing, plan 06's DNS/DKIM warm-up can't start, and the
  funding workstream has no live demo/traction URL for grant applications.

This is the one launch-blocking gap not externally blocked —
Stripe/Fakturownia (18) and legal (09) genuinely wait on company
registration; deploy and analytics wait on nothing.

Runners-up: zero tests on the money path (advisor "L": no component/route/e2e
layer); no error boundaries (unhandled render error = blank screen,
unreported); OTP throttle per-email only; `/api/v1/payments/stub/complete`
(`orders.go`) is unauthenticated — mounted only in stub mode (`router.go`),
but the only prod fail-safe is a `logger.Warn`.

## Verdict: the under-engineered last mile costs more

Over-engineering cost (bounded, mostly sunk): ~2.5 of 8 builder-days (49/158
commits; 33.8k of 45.8k bucketed lines) ≈ 4,000–6,000 zł equivalent at PL
senior contract rates, plus a forward tax of ~20–30% on quote-flow UI work
(dual layouts, no tests) and 831 dead lines. Partly recoverable: the design,
blog, and editor are real brand/SEO assets — once someone can see them.

Under-engineering cost (unbounded, accruing daily): ~2 days of work is
withholding 100% of validation, SEO, and email-warm-up value. Each elapsed
day costs a calendar day of: funnel learning (product.md's success test —
"prove one funnel: upload → believable quote → order click" — is currently
unprovable), Google indexing on 15.8k lines of content, DKIM warm-up, and
traction evidence for grant applications. Had the 2.5 polish days gone to the
last mile, the site would have been live ~5–6 days ago — the gap has already
cost more calendar time than the over-engineering cost builder time, and it
sets the ROI of the polish assets to zero while it persists.

One story: over-engineering is where the hours went; under-engineering is
what they were taken from. Going forward, the editor shell's tax is
~1–2 h/week; the missing deploy is a day per day.

## The number to track

**`order_clicked` events per week, received by a real analytics sink**
(denominator when a rate is wanted: `quote_shown`).

1. Today it is structurally zero — incapable of being nonzero (no deploy,
   sink is `console.info`). That impossibility is the under-engineering cost
   made measurable.
2. It is product.md's own success criterion, and `track('order_clicked')` is
   already wired — only the sink swap + deploy are missing (~2 days).
3. It adjudicates the over-engineering too: if the drone hero and editor
   shell genuinely convert, it shows up here — one number settles both sides
   and prices all future polish work.
4. It doubles as the traction figure for PARP/FENG applications.

Counter-metric pair (watching the over side): share of added lines per week
landing on presentation vs funnel/ops — last week ~74% presentation.

## Recommended actions (proposals, not commitments)

1. Ship minimal plan 03 (~1–2 days): Coolify deploy of the existing compose
   stack + domain (unblocks plan 06 DNS/DKIM). Before exposure: ensure stub
   checkout can't run publicly (env guard refusing `PAYMENTS_PROVIDER=stub`
   outside dev, or deploy in quote/order-request mode until plan 18 +
   incorporation).
2. Fill the designed drop-ins (~0.5 day): point `funnel.ts track()` at
   PostHog/Plausible (self-hostable on the same Coolify box); add Sentry
   (plan 11-lite).
3. Delete `FactoryScene.tsx` + `FactoryHero.tsx` (831 lines, existing
   advisor finding, ~10 min incl. check-strings allowlist entries).
4. Freeze new presentation-layer work until `order_clicked` > 0; review the
   number weekly.

## Reproduce the figures

- Editor shell:
  `find instant-quote/src/components/quote-editor -name '*.ts*' | xargs wc -l`
- Dead scene: `wc -l instant-quote/src/components/Factory*.tsx`;
  `grep -rn "FactoryHero" instant-quote/src --include='*.tsx'` → only
  self-references.
- Funnel sink: `instant-quote/src/lib/funnel.ts` lines 49–50.
- Stub route: `backend/internal/httpapi/orders.go` (`stubComplete`),
  `router.go` (stub-only mount).
- Effort buckets: `git log --numstat` with subject regexes
  `hero|drone|polish|delight|animation|editor|design|landing` vs
  `pay|checkout|order|stripe|faktur|invoice|email|auth|otp`; generated files
  excluded (schema.d.ts, gen.go, \*.sql.go, routeTree.gen.ts, bun.lock).
- Deploy absence: no CI directory; `PUBLIC_BASE_URL` default in
  `backend/.env.example`; plans 03/11/12/18 banners in
  `plans/engineering/ROADMAP.md`.
