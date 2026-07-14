# Prompt: instant-quote prototype (upload 3D file, get a price)

Copy everything below the line into your coding agent.

---

## Role and goal

You are building a production-quality prototype of an instant quoting flow for an EU on-demand 3D printing service based in Poland. Scope is deliberately narrow: a visitor uploads a 3D file and sees a price. No accounts, no checkout, no backend persistence. The prototype exists to validate conversion (upload → quote → "order" click) and to set the UX bar for the real product.

The bar to beat: Weerg.com (instant quote, no login) and SendCutSend.com (upload-to-price in seconds, transparent pricing). The prototype must feel faster and more transparent than both.

## Stack

- Bun as the default runtime, package manager and script runner throughout: `bun create tanstack@latest` (select Start + React + TypeScript), `bun install`, `bun dev`, `bunx` instead of `npx`. Do not use npm, yarn or pnpm anywhere, including in the README.
- TanStack Start (latest stable). File-based routing, server functions via `createServerFn`.
- TanStack Query (latest) for all quote state and recalculation.
- shadcn/ui (latest CLI, `bunx shadcn@latest init`) on Tailwind CSS v4. Use shadcn components throughout: Card, Button, Select, RadioGroup, Slider, Table, Accordion, Skeleton, Badge, Tooltip, Sonner (toasts), Dialog.
- three.js via @react-three/fiber and @react-three/drei for the 3D preview. Load STL with three-stdlib's STLLoader.
- No database, no auth, no payment. Quote submission posts to a server function that just logs and returns an id.

## The flow (one page)

1. **Landing = the tool.** Route `/` renders the uploader directly. Headline, one sentence of trust copy ("Made in the EU. Ships D+1/D+2 to Germany. No account needed."), and a full-width drop zone. No marketing page in front of the tool.
2. **Upload.** Drag-and-drop plus file picker. Accept `.stl`, `.3mf`, `.obj` (parse client-side) and `.step`/`.stp` (accept the file, but show a "STEP needs a quick manual check, quote within 4 business hours" card with an email field instead of an instant price — do not fake a price for STEP).
3. **Parse client-side, instantly.** For STL/3MF/OBJ compute in a Web Worker: watertight-ish volume (signed tetrahedron sum), bounding box, surface area, triangle count. Show a Skeleton quote card while parsing. Target: price on screen in under 5 seconds for a 50 MB STL.
4. **3D preview.** Rotatable, zoomable viewport next to the quote card. Neutral studio lighting, part in a brand color, bounding-box dimensions overlaid (mm). Graceful fallback text if WebGL is unavailable.
5. **Configure and requote.** Every change recalculates the price instantly (client-side pure function wrapped in TanStack Query so the UI treats it as async and stays ready for a real API later):
   - Process/material: MJF PA12 (default), SLS PA12, FDM ASA, FDM PETG, FDM PA-CF, Resin (standard).
   - Quantity: input plus quick-pick chips 1 / 5 / 10 / 25 / 50, and a visible price-break table showing the unit price at each tier so the discount curve does the selling.
   - Lead time: Economy (5 business days, -15%), Standard (3 days, base), Express (next business day, +35%). Show the concrete ship date for each, computed from a Europe/Warsaw clock with a 14:00 same-day cutoff, skipping weekends.
6. **Transparent price breakdown.** An Accordion under the price: material, machine time, finishing, shipping, VAT line (23% PL, shown but toggleable "prices ex VAT"). This transparency is a core differentiator; do not hide the math.
7. **Order intent.** Primary button "Order for {price}" opens a Dialog asking only for email + shipping country, submits via server function, shows a success state with the quote id. This is the conversion event to measure.
8. **Multi-part:** allow up to 5 files, each a row (thumbnail, name, config summary, price) with an order total. Keep the first-file experience optimal; multi-part is secondary.

## Pricing engine

Pure TypeScript module `src/lib/pricing.ts`, fully unit-tested, config-driven so numbers can be tuned without touching logic. Use these defaults (they mirror the venture's economics model):

```
MJF PA12:  volume_cm3 × €0.40
SLS PA12:  volume_cm3 × €0.45
Resin:     volume_cm3 × €0.55
FDM:       weight_g = volume_cm3 × density (ASA 1.07, PETG 1.27, PA-CF 1.15)
           print_h = weight_g / 20   (20 g/h effective throughput)
           price = print_h × €4.00 + weight_g × material €/kg / 1000
           (ASA €20/kg, PETG €18/kg, PA-CF €45/kg)
Quantity discount on unit price: 1: 0%, 5: 5%, 10: 12%, 25: 20%, 50: 28% (interpolate between tiers)
Lead time multiplier: Economy 0.85, Standard 1.00, Express 1.35
Minimum order value: €15 (applies to order total, not per part; show "minimum order €15" hint when it binds)
Shipping: €9 flat EU, free above €250; display "ships D+1 to PL/DE, D+2 rest of EU"
```

Also return simple DFM flags with the quote, rendered as Badges with Tooltips:
- Part exceeds build volume (MJF: 380×284×380 mm; FDM: 350×350×350 mm) → block quote for that process, suggest another.
- Smallest bbox dimension < 1 mm → "feature size warning".
- Volume < 1 cm3 → "minimum billable volume 1 cm3" (bill 1 cm3).
- Mesh not watertight (negative or absurd volume) → quote from convex-hull volume estimate and flag "geometry approximated".

## UX quality bar

- No login, no email, no cookie wall before the price. Nothing gates the quote.
- Price updates in under 100 ms on config changes; use optimistic UI, never a spinner for recalculation.
- Mobile works, but optimize for desktop (engineers at workstations).
- Dark-on-light, clean industrial look; system font stack or Inter; one accent color. No stock photos.
- Empty state, parsing state, error state (corrupt file, >100 MB, unsupported format) all designed, all recoverable, errors via Sonner toasts plus inline hints.
- Keyboard and screen-reader accessible drop zone (it is also a button).
- A small "How we price" link opening a Dialog that explains the formula in plain language.

## Engineering constraints

- TypeScript strict. Oxlint for linting (`bunx oxlint`, wired into a `bun run lint` script with type-aware rules enabled and correctness rules as errors). Prettier only for formatting. No ESLint.
- Mesh math in a Web Worker (comlink or plain postMessage) so the main thread never blocks.
- Pricing engine and mesh-volume math covered by unit tests run with `bun test` (Vitest-compatible assertions are fine, but the runner is Bun's), including known-volume fixtures (a 10 mm cube STL = 1 cm3) and the discount interpolation.
- TanStack Query owns quote state: `useQuery(['quote', fileHash, config])` with the pure pricing function as the fetcher; `staleTime: Infinity` since inputs are hashed. This makes swapping in a real quoting API a one-file change.
- Server function `submitQuote` validates input with zod and returns `{ quoteId }`.
- Log a simple funnel event to console for: upload_started, parse_succeeded, quote_shown, config_changed, order_clicked, order_submitted. Structure them so PostHog can be dropped in later.
- README with setup, the pricing config explained, and a list of what is intentionally fake.

## Out of scope (do not build)

CNC quoting of any kind, STEP geometry analysis, accounts, saved parts, payments, admin panel, i18n framework (hardcode English strings but keep them in one file), real DFM analysis like wall thickness maps.

## Definition of done

A fresh `bun install && bun dev` gives a page where dropping `benchy.stl` shows a rotatable preview and a correct MJF PA12 price for qty 1 in under 5 seconds, changing quantity to 10 updates the unit price instantly with the discount visible, Express shows tomorrow's date before the 14:00 cutoff, and clicking Order captures an email. `bun test` and `bun run lint` pass clean.
