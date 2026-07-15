# 15 — Fulfillment & shipping integration

*Phase 3 — post-launch. Lighter plan by design: scoping + sequencing.*

## 1. Context

Shipping today is a pricing constant: flat 20 zł, free ≥ 500 zł, one rate for all 25 EU countries in the enum (`backend/internal/pricing`), and fulfilment is entirely manual — plan 07 gives the admin a tracking-number *field*, but the label, carrier choice, and tracking number itself all happen outside the system. Adequate at launch volume; this topic automates it when volume justifies.

## 2. Decisions applied

Pinned: Go backend owns carrier integrations; jobs via Coolify tasks; money in grosze; per-country rates ship as pricing-config snapshots (plan 07 editor). Topic-local: **InPost ShipX API first** (Polish default — Paczkomaty locker network is the strongest domestic conversion lever), DPD/DHL for DE/EU as the second integration; customs docs N/A intra-EU (revisit only if UK/CH is added).

## 3. Implementation phases

1. **Per-country rates** — replace the flat rate with a per-country (or zone: PL / DE-AT-CZ-SK / rest-EU) shipping table in the pricing config; editable via plan 07's snapshot editor; free-shipping threshold stays order-level. *Verify:* golden cases extended for 3 representative countries; checkout shows the country-correct rate.
2. **Packaging estimation** — estimate parcel weight (part weights from mesh metrics + packaging allowance) and dims (bounding boxes via the packing module) at order time; stored on the order for label purchase. *Verify:* estimates within one parcel-size class of reality for the calibration corpus (plan 14's models).
3. **InPost ShipX integration** (`backend/internal/shipping/inpost.go`) — create shipment from admin (plan 07 order detail gains "buy label": service selection incl. Paczkomat point, label PDF download, tracking number auto-filled → the `shipped` transition + plan 06 email fire automatically). Paczkomat point picker at checkout (InPost geowidget) is a **separate, later step** — admin-side labels first. *Verify:* sandbox shipment round-trips: label PDF + tracking number land on the order; shipped email carries a working InPost tracking URL.
4. **Tracking webhook/poll** — ShipX status → `delivered` transition (closes the lifecycle loop without manual admin action); poll via `api tracking-sweep` if webhooks are unavailable. *Verify:* sandbox delivery event flips a test order to `delivered`.
5. **DPD or DHL for DE-bound parcels** — same `shipping` interface, second implementation; carrier chosen per destination at label time. *Verify:* one DE sandbox label round-trip.

## 4. Dependencies

Requires 05 (orders + lifecycle), 07 (admin surface it lives in), 06 (shipped/delivered emails). Phase 1 can land any time after 07 (config-only). InPost API credentials = external prerequisite (business account).

## 5. Verification

- [ ] Country-correct shipping at checkout for PL/DE/other-EU test cases.
- [ ] Admin buys a real (sandbox) label; tracking number + PDF on the order; shipped email automatic with valid tracking link.
- [ ] Delivered status arrives without manual action.
- [ ] Weight/dims estimates validated against real parcels for the first N live orders (calibration note in plan 14's log).

## 6. Risks & open questions

- **ShipX sandbox fidelity** (locker selection, label formats) — validate early; InPost's API is well-documented but organization-account onboarding takes time (external prerequisite).
- **Paczkomat checkout UX** adds a picker step to the deliberately-frictionless flow — measure conversion impact (plan 11 funnel) before/after; keep courier-to-address as the zero-extra-click default.
- Open: shipping price = cost pass-through vs flat-with-margin — a pricing stance for plan 14's calibration once real label costs exist.
