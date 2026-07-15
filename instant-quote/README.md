# Instant Quote

An instant quoting flow for an EU (Poland-based) on-demand 3D-printing service.
A visitor drops a 3D file and sees a transparent price in seconds — no account,
no checkout. Everything runs client-side except a single quote-submission server
function. It exists to validate one funnel: **upload → quote → "order" click**.

- Made in the EU. Ships D+1/D+2 to Germany. No account needed.
- Accepts `.stl`, `.3mf`, `.obj`, and `.step`/`.stp` — all priced instantly
  (STEP is tessellated in the browser via OpenCascade WASM).
- Mesh math (volume, bbox, surface area, watertight check) runs in a Web Worker.
- 3D preview via three.js. Pricing is a pure, unit-tested TypeScript engine.

## Requirements

[Bun](https://bun.sh) only — it is the runtime, package manager, and test
runner. There is no npm/yarn step anywhere in this project.

## Getting started

```bash
bun install
bun run dev        # http://localhost:3000
```

## Scripts

```bash
bun run dev         # dev server (Vite + TanStack Start)
bun run build       # production build
bun run preview     # preview the production build
bun test            # unit tests (pricing, lead time, mesh volume)
bun run lint        # oxlint, type-aware, correctness = error
bun run format      # prettier --write
bun run typecheck   # tsc --noEmit
```

## How pricing works

All tunable numbers live in `src/lib/pricing-config.ts` (the `PRICING` const).
The engine in `src/lib/pricing.ts` is pure and reads only from that config — no
magic numbers, no `Date`/random/I/O — which is why the pricing tests need zero
setup. Change a price by editing the config; the engine and UI follow.

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

## Intentional fakes (this is a prototype)

These are deliberately stubbed — no backend, no persistence, no payment:

- **No database / no accounts.** Nothing is stored. Reloading the page clears
  all parts and quotes.
- **`submitQuote` / `requestStepQuote`** (`src/server/quote.functions.ts`) are
  real TanStack Start server functions with Zod validation, but they only
  `console.info` the payload and return a generated id (`Q-XXXXXXXX` /
  `STEP-XXXXXXXX`). No email is sent, no order is created.
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
  routes/            # __root.tsx (providers, Toaster) + index.tsx (the whole tool)
  components/        # DropZone, PartViewer (R3F), QuoteCard, OrderDialog, ui/…
  lib/
    pricing-config.ts  # every tunable number
    pricing.ts         # pure pricing engine
    leadtime.ts        # Europe/Warsaw ship-date math (pure, injectable `now`)
    mesh/              # DOM-free STL/OBJ parsers, analyze, convex hull
  workers/mesh.worker.ts   # SHA-256 + mesh analysis off the main thread
  hooks/             # useParts, useMeshWorker
  server/            # submitQuote, requestStepQuote
tests/               # pricing, leadtime, mesh-volume + fixtures
```

## Stack

TanStack Start (file routing + server functions) · TanStack Query (quote state,
`staleTime: Infinity`) · shadcn/ui on Tailwind CSS v4 · three.js via
@react-three/fiber + drei · Zod · oxlint + Prettier · `bun test`.
