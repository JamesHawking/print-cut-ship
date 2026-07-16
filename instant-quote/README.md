# Instant Quote

An instant quoting flow for an EU (Poland-based) on-demand 3D-printing service.
A visitor drops a 3D file and sees a transparent price in seconds — no account,
no checkout. Mesh parsing and the 3D preview run client-side; pricing and all
other API surface live in the Go backend at [`../backend`](../backend). It
exists to validate one funnel: **upload → quote → "order" click**.

- Made in the EU. Ships D+1/D+2 to Germany. No account needed.
- Accepts `.stl`, `.3mf`, `.obj`, and `.step`/`.stp` — all priced instantly
  (STEP is tessellated in the browser via OpenCascade WASM).
- Mesh math (volume, bbox, surface area, watertight check) runs in a Web Worker.
- 3D preview via three.js. Pricing is a pure, unit-tested TypeScript engine.

## Requirements

[Bun](https://bun.sh) only — it is the runtime, package manager, and test
runner. There is no npm/yarn step anywhere in this project.

## Getting started

Two processes: the Go API (`:8080`, needs Go 1.26+) and the frontend dev
server (`:3000`, proxies `/api` to the API — override with `API_PROXY`).
One command runs both from the repo root:

```bash
bun install        # once, in instant-quote/
make dev           # from the repo root — Go API + frontend, Ctrl+C stops both
```

Or run them separately (`make dev-backend` / `make dev-frontend`, or by hand):

```bash
cd ../backend && go run ./cmd/api        # terminal 1
bun run dev                              # terminal 2, in instant-quote/
```

### Optional: MakerWorld URL import

Pasting a `makerworld.com/…/models/…` link into the dropzone downloads that
model's default print-profile 3MF via the backend and quotes it like a local
file. This uses MakerWorld's undocumented endpoints and needs a Bambu Cloud
bearer token in the **backend's** environment:

```bash
BAMBU_CLOUD_TOKEN=eyJ... go run ./cmd/api
```

Grab the token from a logged-in makerworld.com session (devtools → Application
→ Cookies → `token`). It expires after ~90 days; an expired or missing token
degrades to a clear error toast, everything else keeps working.

## Scripts

```bash
bun run dev         # dev server (Vite + TanStack Start)
bun run build       # production build
bun run preview     # preview the production build
bun test            # unit tests (mesh volume, STEP geometry, MakerWorld URLs)
bun run lint        # oxlint, type-aware, correctness = error
bun run format      # prettier --write
bun run typecheck   # tsc --noEmit
```

## How pricing works

The pricing engine lives in the Go backend (`backend/internal/pricing`) and is
served via `POST /api/v1/price`; the UI requotes through that endpoint on every
config change (the free-form quantity input debounces ~250 ms). Tunable numbers
live in `backend/internal/pricing/config.go` and are exposed to the UI via
`GET /api/v1/config`, so displayed constants can't drift from what is charged.
(The engine started life in TypeScript here; the Go port is pinned to it by
golden-fixture tests — see `backend/README.md`.)

Rates and structure follow the Polish FDM service **mapi-tech.pl** (quoted
through its SeekMake widget); the reverse-engineered model is documented in
[`references/mapi-tech-pricing.md`](references/mapi-tech-pricing.md). Currency is
PLN (zł).

**Per-part unit price**

- FDM materials, priced by weight and machine time. Weight approximates a
  slicer's walls + solid top/bottom as a shell plus 20% infill of the interior:
  `shell_cm3 = min(volume, surface_area_cm2 × 0.09)` (0.9 mm shell),
  `weight_g = (shell_cm3 + 0.20 × (volume_cm3 − shell_cm3)) × density`,
  `material = weight_g × zł/kg × factor / 1000`,
  `machine = (weight_g / 12 g·h⁻¹) × zł/h`, `base = material + machine`.
  The 0.9 mm shell is calibrated against mapi-tech's real quote for
  `tests/test_object.step` (33.67 zł PETG → we price 33.51 zł, −0.5%).
  Materials (density / zł·kg⁻¹ / factor / zł·h⁻¹): PLA 1.25 / 50 / 1.0 / 1.8,
  PETG 1.27 / 50 / 1.2 / 2.25, PCTG 1.23 / 150 / 1.0 / 2.25,
  ASA 1.05 / 120 / 1.5 / 2.5, PETG FR 1.03 / 180 / 1.0 / 2.5,
  PA12-CF 1.08 / 350 / 2.0 / 3.5, Iglidur I150PF 1.30 / 550 / 1.0 / 3.5.
- Quantity discount (piecewise-linear between tiers, clamped above 50):
  1 → 0%, 5 → 5%, 10 → 12%, 25 → 20%, 50 → 28%.
- Lead-time multiplier (mapi-tech): Economy ×0.90, Standard ×1.0, Express ×1.30.
- Every part is floored at the **1.50 zł** minimum part price.

**Order level**

- Minimum order 30 zł (top-up applied once, across all parts).
- Flat 1 zł order fee (observed in mapi-tech's cart).
- Shipping 20 zł flat, free at/above 500 zł.
- Prices are **gross** — 23% VAT (PL) is included, not added on top, matching
  mapi-tech's checkout. The breakdown can show the ex-VAT total instead.

**DFM checks**

- Exceeds build volume → part is blocked (bbox is compared against the 320×320×320
  mm build envelope with rotation allowed; all materials share one envelope).
- Smallest dimension < 1 mm → thin-feature warning.
- Volume < 1 cm³ → billed as 1 cm³.
- Non-watertight mesh → volume is estimated from the convex hull and flagged
  "geometry approximated".

The breakdown lines shown to the user always sum exactly to the line total.

## i18n & SEO conventions

Everything user-facing follows these rules — later content pages (materials,
pricing, comparisons, blog) build on them.

**Locales.** `/pl` (default, `x-default`) and `/en`, as file routes under
`src/routes/$locale/`. `/` never renders: it redirects by `locale` cookie →
`Accept-Language` → `/pl`. The language switcher (SiteHeader) is the only
cookie writer. All copy lives in `src/lib/i18n/{pl,en}.ts` — `pl.ts` is the
source of truth (`Dictionary = typeof pl`), `en.ts` must `satisfies
Dictionary`, so a key missing in either locale is a compile error.
Parameterized copy is function-valued per key; PL plurals via `plPlural`.
Components read `useStrings()`/`useLocale()`; client event handlers outside
the render tree use `getStrings(getActiveLocale())`. `bun run check-strings`
fails on hardcoded JSX prose (`// i18n-exempt` is the escape hatch). The
backend returns machine codes + params; the dictionary owns all human text
(`apiError`/`dfm`/`breakdown` namespaces, mapped via `src/lib/api/errors.ts`).
Formatters (`src/lib/format.ts`) take an explicit `locale`.

**SEO.** `src/lib/seo.ts` owns the head surface: every route's `head()` calls
`seoHead({locale, path, title, description, image?, noindex?})` for title,
description, canonical, OG/Twitter and hreflang (app screens pass `noindex`);
JSON-LD goes through `jsonLd(...)` builders (`Organization` + `WebSite`
site-wide on the `$locale` layout; `breadcrumbJsonLd` for content pages).
Absolute URLs come from `SITE_URL` = `VITE_SITE_URL` (env) with a placeholder
default — set the real origin in Coolify env and mirror it in
`public/robots.txt`. Indexable pages are listed in `vite.config.ts`
`publicPages`: each entry is prerendered at build time and emitted into
`sitemap.xml` with hreflang alternates (add new content routes there).
Anything rendering the wall clock must use `useWarsawClock()` (client-mounted
placeholder) so prerendered HTML stays hydration-stable.

**CTA & analytics.** Every content page ends in `<QuoteCta variant="compact"|
"full" sourcePage="…"/>` — it deep-links to the landing intake with
`?source=` and fires `cta_upload_clicked`. `page_view {path, locale,
referrer, source?}` fires from the router's `onResolved` subscription
(`src/router.tsx`). Events stay console-only PostHog-shaped (`src/lib/funnel.ts`).

## Intentional fakes (this is a prototype)

These are deliberately stubbed — no backend, no persistence, no payment:

- **No database / no accounts.** Nothing is stored. Reloading the page clears
  all parts and quotes.
- **`POST /api/v1/quotes` / `/api/v1/step-quotes`** (Go backend) validate the
  payload and recompute prices server-side, but only log it and return a
  generated id (`Q-XXXXXXXX` / `STEP-XXXXXXXX`). No email is sent, no order is
  created.
- **Funnel analytics** (`src/lib/funnel.ts`) log PostHog-shaped events to the
  console (`upload_started`, `parse_succeeded`, `quote_shown`, `config_changed`,
  `order_clicked`, `order_submitted`, …). `track()` has a marked drop-in point
  for a real `posthog.capture()`.
- **Lead-time ship dates** are computed from the Europe/Warsaw wall clock and a
  14:00 cutoff, but there is no real production calendar or capacity model.
- **STEP files** are auto-priced: occt-import-js (OpenCascade WASM, lazy-loaded
  in the mesh worker) tessellates the B-rep in the browser. If OCCT can't read
  a file, it falls back to the manual-quote email card.
- **Print weight and time are estimated, not sliced.** We have no slicer, so
  weight is a shell + infill approximation of the toolpath and machine time is
  derived from that weight (`weight_g / 12 g·h⁻¹`). mapi-tech's own quotes come
  from SeekMake's slicer; ours is calibrated to it on one reference part.
- The material rates mirror mapi-tech's published config; **shipping (20 zł /
  free ≥ 500 zł) is a sensible PL default**, not part of their extracted config.

## Project layout

```
src/
  routes/            # __root.tsx (providers, Toaster), index.tsx (/ locale redirect)
    $locale/         # route.tsx (layout: locale ctx + JSON-LD), index (landing),
                     # quote, login, orders — all /pl/* + /en/*
  components/        # DropZone, PartViewer (R3F), QuoteCard, QuoteCta, OrderDialog, ui/…
  lib/
    api/               # generated OpenAPI types + typed client + error-code mapping
    i18n/              # pl.ts (source of truth), en.ts, detect, plurals
    seo.ts             # seoHead(), jsonLd builders, SITE_URL
    catalog-static.ts  # landing-page marketing figures (mirrors backend config)
    mesh/              # DOM-free STL/OBJ/3MF/STEP parsers, analyze, convex hull
  workers/mesh.worker.ts   # SHA-256 + mesh analysis off the main thread
  hooks/             # useParts, useMeshWorker, useApi, useWarsawClock
scripts/             # check-strings.ts (no hardcoded copy gate)
tests/               # mesh-volume, STEP geometry, MakerWorld URLs + fixtures
../backend/          # Go API: pricing, ship dates, quotes, MakerWorld proxy
```

## Stack

TanStack Start (file routing) · TanStack Query · openapi-fetch against the Go
backend · shadcn/ui on Tailwind CSS v4 · three.js via @react-three/fiber +
drei · oxlint + Prettier · `bun test` · Go backend: chi + oapi-codegen.
