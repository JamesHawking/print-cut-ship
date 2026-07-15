# 14 — Pricing engine & quoting improvements

*Phase 3 — post-launch. Lighter plan by design: scoping + sequencing.*

## 1. Context

The core is solid and calibrated — and now lives in Go (`backend/internal/pricing`, golden-fixture-pinned: shell 8 g/h + infill 18 g/h two-rate model, 0.9 mm shell weight, gross VAT, 1 zł fee, anchored to the mapi-tech 33.67 zł and Basket 21.64 zł references). Known weaknesses, from memory and e2e observation: the **10 zł extra-plate fee is uncalibrated**; **geometric packing over-fits** (an e2e MakerWorld model packed to 1 plate where Bambu's slicer splits to 2 — `internal/pricing/packing.go` shelf/FFD ≠ Bambu's plate logic); shell/infill rates rest on only **two reference anchors**; quotes are ephemeral (persistence landed in plan 01, but expiry/links are unbuilt).

## 2. Decisions applied

Pinned: engine changes happen **in Go** with golden-fixture discipline (plan 12's regeneration policy: never hand-edit; regenerate from a trusted engine state and log the intentional change); config rates editable via plan 07's snapshot editor — calibration outcomes ship as new snapshots, no deploys; quote persistence/IDs from plan 01.

## 3. Implementation phases

1. **Calibration corpus** — collect 15–25 reference quotes: more mapi-tech anchors across sizes/materials/quantities + real print data (actual filament use + print time from own orders once they flow). Store as a fixtures file (`backend/internal/pricing/testdata/calibration.json`) with source + date. *Verify:* current engine's error distribution over the corpus is quantified (mean/max % deviation).
2. **Rate re-fit** — re-fit shell/infill rates + extra-plate fee against the corpus (least-squares over the two-rate model; keep the model form, change constants). Ship as a **pricing-config snapshot** via plan 07's editor. *Verify:* deviation vs corpus within a stated tolerance (target ±10% like the original anchor); goldens regenerated + change logged.
3. **Packing accuracy** — compare `packing.go` plate counts against Bambu Studio's actual splits for the corpus models; tune gutter/margin params or add a conservatism factor (prefer over-counting plates slightly to under-counting — undercharging is the asymmetric loss). Long-term option recorded: slicer-in-the-loop (CLI slicer server-side) is the accuracy endgame — a real queue-shaped job, revisit with BullMQ note from DECISIONS. *Verify:* plate-count match rate on the corpus reported; the known 1-vs-2 case fixed.
4. **Quote persistence UX** — "your quote is valid 14 days": set `quotes.expires_at` (column exists, plan 01), a shareable quote link (`/q/{shortId}` rendering the persisted quote read-only), expiry sweep (`api quote-expiry-sweep`, plan 03 runner), re-quote-at-current-prices affordance on expired quotes. *Verify:* link renders after browser close; expired quote shows re-quote path; ordering an expired quote is blocked.
5. **Material/color expansion** — additional PLA/PETG colorways + engineering materials as config-snapshot additions (the `PROCESS_IDS` structure anticipates this); each addition needs a calibration entry. *Verify:* new material quotable end-to-end without deploy (snapshot-only change).

## 4. Dependencies

Requires 01 (persisted quotes), 07 (config editor as the shipping vehicle), 12 (golden regeneration policy). Real-order data (phase 1) needs the shop live — inherently post-launch. Coordinates with 02 (server metrics feed calibration data collection).

## 5. Verification

- [ ] Calibration corpus ≥ 15 entries with provenance; error metrics computed and logged.
- [ ] Re-fit rates within tolerance; deployed as a snapshot (no deploy); old orders untouched (plan 05 snapshot immutability re-checked).
- [ ] Plate-count accuracy measured; the known over-fit case resolved.
- [ ] Quote links + 14-day expiry work end-to-end.
- [ ] Golden fixtures regenerated per policy with a recorded calibration log entry.

## 6. Risks & open questions

- **Two-anchor overfit risk is the whole point** — don't tune constants before the corpus exists (phase order is load-bearing).
- **mapi-tech as ground truth** drifts if they re-price; date-stamp every anchor; own-print data supersedes competitor anchors over time.
- **Packing conservatism** trades occasional overcharge for never undercharging — a product/pricing stance; revisit against real complaint data.
- Open: slicer-in-the-loop (kiri:moto or Bambu CLI) — big accuracy win, big operational surface (queue, timeouts, slicer versioning). Decide only after phase 3 data shows geometric packing's ceiling.
