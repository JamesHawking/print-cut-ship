# sendcutsend.com — capability review vs MICRO_FACTORY

Competitor research, captured 2026-07-18 from <https://sendcutsend.com/>, the
public FAQ (<https://sendcutsend.com/faq/>), and app entry points
(`app.sendcutsend.com/customer` — the app itself is JS-gated, so app-level
features are inferred from the marketing site, FAQ, and documented flows).

Purpose: gap analysis of **MICRO_FACTORY** (EU FDM 3D-printing instant-quote app)
against SendCutSend's app and feature set, for planning follow-up work.

## Framing caveat

SendCutSend is **sheet fabrication** (laser cutting, waterjet, CNC routing,
bending, finishing); MICRO_FACTORY is **FDM 3D printing**. Process-level features
(DXF intake, material x thickness matrix, bend/tapping/hardware insertion, 2D
sheet nesting) do not translate to our process. The meaningful comparison is
the **app + commerce funnel**.

Note: `business/product.md` already positions against their UX ("dense
configuration walls, prices buried several steps deep... Do not make the
visitor fill a form or click through stages before a price appears").

## Their app & feature inventory

### Quoting / intake
- Instant pricing on upload: **DXF, DWG, EPS, AI, STEP/STP**.
- **Parts Builder**: 60+ customizable part templates for users without CAD.
- **Design services**: sketch-on-graph-paper → CAD conversion; scanning of
  paper/cardboard/other disposable templates; "design partners" referral
  network.
- Per-part service configuration: bending, countersinking, dimple forming,
  hardware (PEM) insertion, tapping, anodizing (5 colors), plating
  (zinc/nickel), powder coating (11 options), tumbling, deburring.
- Service eligibility gating in-app (e.g. finishing requires a ≥.063" hanging
  hole, size limits, compatible material) — explained via FAQ.
- Part preview **with measurement tools** (in-viewer material-spec display not
  verifiable from public pages).
- Mirror/duplicate part button for mirrored orders.

### Commerce
- Full checkout, credit cards; **NET 30 credit terms** with purchase-order
  attachment for business accounts.
- **Formal Quotes**: shareable link so an accounts-payable department can pay
  while the order stays associated with the requester's account.
- **Saved Carts**: unique shareable link; anyone with the link can purchase an
  exact copy of the cart.
- Real-time ship-date estimate in cart as parts/services are added.
- **Rush tiers**: Fast (rush production), Faster (rush + overnight shipping),
  Fastest (order by noon 12pm PST → ships within 24 h, overnight).
- Standard production: 2–4 business days before shipping (parts without
  added services).
- Order history, tracking, reorder in account.
- Money-back guarantee (refund or remake).

### Catalog / content
- **175+ materials** in stock across metals, composites, plastics, rubber/
  gasket, boards, woods — each with thickness range, per-thickness cut
  tolerance, min/max part size charts, processing size charts.
- Material selection guide, laser cutting guidelines, bending guidelines,
  **bend calculator**, **hardware catalog**, free Fusion 360 gauge tables,
  free font packages, laser cutting templates.
- Blog, education video series, podcast, CAD tutorials, FAQ (15 categories).
- English only.

### Growth / other
- **Marketplace**: designers list parts as Products; SendCutSend fulfills.
- Partner program (creators get account credits + discount codes).
- Merch store, gift cards.
- Trust signals: Fortune-500 customer logos, 853 five-star reviews shown
  (2026-07-18),
  CAGE/DUNS/DFARS/SAM certifications, Inc. 5000 / Deloitte Fast 500.
- Three US facilities (Reno NV, Paris KY, Arlington TX).

## Side-by-side (funnel/app level)

| Area | SendCutSend | MICRO_FACTORY today |
|---|---|---|
| Instant pricing | Upload DXF/DWG/EPS/AI/STEP | STL/OBJ/3MF/STEP — incl. **browser-side STEP tessellation** (they process server-side) |
| Account | Not needed to quote; needed for orders/tracking | None at all (simulated OTP only — Plan 04 ⬜) |
| Checkout / payment | Full checkout, cards, NET 30 + PO | None — no order placement, no PSP (Plan 05 ⬜) |
| Quote artifacts | Formal Quotes (AP-payable link), Saved Carts (shareable re-purchasable cart) | Quote read-back API exists (`GET /quotes/{id}`); no share page (Plan 14) |
| No-CAD entry | Parts Builder, 60+ templates, design services | Bundled sample part only |
| Per-part options | 12 services (bending … powder coat) | Material + quantity + lead-time tier; no post-processing/colors |
| Part preview | 3D preview + measurement tools + specs | 3D preview (R3F), no measurement tools |
| Orders | History, tracking, reorder, mirror/duplicate | `/orders` list is a prototype, no lifecycle |
| Materials | 175+ w/ per-thickness specs, size charts | 7 filaments, 3 marketing pages |
| Lead time | Real-time ship date + 3 rush tiers (same-day option) | Ship-date engine with 3 tiers (comparable) |
| DFM | Guidelines/FAQ ecosystem, in-app eligibility checks, bend calculator | 5 automated DFM flag codes returned by engine |
| Marketplace | Yes | No |
| Trust/commerce | Money-back guarantee, refunds, gift cards, invoicing, certs | None (legal pages Plan 09 ⬜) |
| i18n | English only | Full PL/EN, localized slugs, hreflang, engine-generated reference prices |

## Where MICRO_FACTORY genuinely leads

- **Zero-friction price-first funnel** — price visible before any form (the
  stated anti-SendCutSend stance, delivered).
- **Server-authoritative re-pricing with content-hash anti-tamper**
  (`backend/internal/httpapi/verify.go`) — client prices never trusted;
  hash mismatch is a hard 400.
- **In-browser STEP parsing** via OpenCascade WASM (`parse-step.ts`) with a
  graceful manual-quote fallback (`StepManualCard.tsx` → `POST /step-quotes`).
- **MakerWorld URL import** — zero-effort acquisition hook with no SCS analog.
- **i18n/SEO machinery** — localized slugs, per-locale RSS, JSON-LD, sitemap
  with hreflang, content-page zł figures generated from the engine
  (`reference-prices.json`, enforced by `no-literal-prices.spec.ts`).
- **Pricing engine regression-pinned** by 1,512 part-quote golden fixtures
  (plus order-total, packing, mesh and lead-time golden sets).

## Gaps worth borrowing (mapped to existing plans)

Priority order by leverage vs existing groundwork:

1. **Shareable quote/cart link** (`/q/{shortId}`) — their Saved Carts / Formal
   Quotes drive B2B adoption (AP departments, shared builds). Backend read-back
   already exists; this is Plan 14 territory and small.
2. **Checkout + payments + order lifecycle** — Plan 05. Without it the app is
   a calculator, not a store. Includes VAT invoicing (Fakturownia evaluated,
   not built).
3. **Real accounts with order history & reorder** — Plan 04.
4. **Rush/expedite merchandising** — we already have Economy/Standard/Express
   multipliers; SCS shows how to sell speed (order by noon → ships same day).
   Cheap UX win on the existing lead-time engine.
5. **In-viewer measurement tools** — small, high-trust feature; our R3F viewer
   already renders the mesh with known units.
6. **Parts Builder / templates** — their #1 no-CAD conversion hook. Big build;
   no plan exists. Our sample-part flow is the seed.
7. **Per-part post-processing options** (colors, vapor smoothing, etc.) — new
   pricing dimension; no plan exists.
8. **Formal B2B artifacts** — PDF quote and VAT invoice sit at the Plans
   05/06 seam (Fakturownia); PO / NET-30 terms are unplanned (would be a new
   decision — plans 05/06 scope prepay only).

## Sources

- Homepage: <https://sendcutsend.com/> (services, materials, pricing examples,
  rush tiers, intake options)
- FAQ index: <https://sendcutsend.com/faq/> (Saved Carts, Formal Quotes, NET 30
  + PO, preview tools, mirror parts, finishing eligibility)
- App: <https://app.sendcutsend.com/customer> (JS-gated; entry points for
  quote / register / login / parts-builder observed in marketing links)
- Marketplace: <https://sendcutsend.com/marketplace/>
