# 16 — Feature backlog (customer-facing)

*Phase 3 — post-launch. This is a triaged backlog, not an implementation plan: each item gets its own mini-plan when picked. Order below is the recommended pick order.*

## 1. Context

Candidates that improve the customer surface but gate nothing. The quoting core (multi-format upload incl. auto-quoted STEP, MakerWorld import, multi-plate 3MF on the H2S envelope, DFM checks) shipped in the prototype phase; plans 01–12 make it a shop. These are the "after it works" items.

## 2. Backlog (triaged)

1. **Accessibility audit (WCAG 2.2 AA)** — first pick: it's a stated commitment in `PRODUCT.md`, partially built (keyboard dropzone, reduced-motion, non-WebGL fallback) but never audited. Scope: keyboard pass over the full quote→checkout flow, contrast sweep of the TE-palette tokens, screen-reader labels on the viewer/config controls, focus management in dialogs. Exit: axe-core clean + manual SR pass documented in the verify skill.
2. **Quote sharing links** — mostly done by plan 14's `/q/{shortId}` page; the increment is a "copy link" affordance + OG card for shared quotes. Small.
3. **Customer dashboard improvements** — re-order past parts (files retained per plan 02 → one-click re-quote at current prices), saved addresses (extends plan 04's account), invoice list. Pick when repeat-customer rate justifies it (plan 11 data).
4. **STEP quoting hardening** — auto-quoting works (client-side occt WASM); the manual-email card is the parse-failure fallback. Increment: server-side STEP recompute story (closes plan 02's `manual_verify` gap — occt in a sidecar/WASM runtime), plus telemetry on parse-failure rate to size the problem first.
5. **DFM feedback expansion** — wall-thickness analysis exists; surface actionable suggestions (orientation hints, "scale up 15% to clear min wall", material swap suggestions). Differentiator territory; needs design care to not clutter the deliberately-clean quote card.
6. **More processes beyond FDM** — the pricing engine's process structure anticipates SLS/MJF/resin. Each new process = supplier or machine reality first, then a config snapshot + calibration entries (plan 14 pattern). Business decision before code.
7. **MakerWorld import hardening** — undocumented API; monitor breakage via plan 12's weekly live canary + plan 10's token check; degrade gracefully (already does). No official API expected; keep the surface thin, don't invest ahead of breakage.

## 3. Dependencies

Item 1 needs nothing (do any time); 2–4 build on 14/04/02 respectively; 5–6 are product bets informed by plan 11's funnel data; 7 is maintenance posture, not a project.

## 4. Verification

Each item's mini-plan defines its own; the backlog-level check is quarterly: re-triage against PostHog funnel data (where do quoters drop?) and support-inbox themes (what do customers actually ask for?).

## 5. Risks & open questions

- The standing risk for this whole topic is building 3–6 before the funnel data says which one matters — the dashboard (plan 11) is the triage tool; resist gut-picking.
- Open: at what order volume does item 3 (accounts/re-order) beat item 5 (DFM suggestions) for effort→revenue? Revisit at the first quarterly triage.
