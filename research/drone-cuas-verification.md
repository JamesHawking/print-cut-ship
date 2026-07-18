# Drone / C-UAS demand verification

Verification pass on three business assumptions, captured 2026-07-17. Builds on
`research/eu-market/EU_on_demand_manufacturing_audit.docx` (14 July 2026, cited
below as "audit [n]") plus fresh primary checks. Facts, estimates, and
assumptions are labeled, matching the audit's convention.

## The assumptions under test

1. A great instant-quote UI for FDM printing orders is a viable wedge.
2. Expand later into other processes (CNC, MultiJet/MJF).
3. Dual-use drone and counter-UAS (C-UAS) products need exactly these
   manufacturing capabilities, so research that demand as a target segment.

## Verdicts

### 1. FDM instant-quote UI — verified as a wedge, not as a business

- The UX gap is real. Only Weerg and Craftcloud quote without a login in the
  EU; Xometry requires an account plus a EUR 30 minimum; Protolabs has a ~USD
  95 practical floor (audit §4, FACT). The closest Polish competitor,
  mapi-tech.pl, does not own its quoting UX at all — it white-labels
  SeekMake's widget (see `research/competitors/mapi-tech-pricing.md`). Nobody
  in CEE runs a branded, no-login instant-quote operation. Our positioning in
  `business/product.md` matches this gap.
- But commodity FDM is hostile territory. JLC3DP sells parts from USD 0.30;
  Bambu Lab shipped ~2.7M printers/year by 2025, migrating simple one-off FDM
  orders in-house (audit §2.3, §8, FACT). On small parts, revenue comes from
  minimums, not per-gram rates (confirmed empirically on mapi-tech: a 2 g
  PETG cube prices at the 1.5 PLN part minimum, raw computed price ~1.21
  PLN).
- **Read:** FDM is the acquisition funnel, not the P&L. The audit's prescribed
  validation before scaling any FDM farm: a PL/DE quoting landing page + EUR
  3–5k of search traffic, measuring quote→order conversion. The EU
  prosumer-to-China order flow is unmeasured anywhere (audit §5.1, known gap)
  — this is the single most important number to validate cheaply.

### 2. Expand to CNC / MJF — verified, and sequencing argues for earlier

- Margin evidence: Weerg reports ~EUR 18M revenue at ~40% EBITDA on a uniform
  fleet of 28–30 HP MJF machines (audit §2.1, company claim; FY2024 filed:
  EUR 13.6M rev / EUR 1.75M net, FACT). Protolabs earns ~49% gross margin in
  its own factories vs ~29% implied in its partner network (FACT). Asset-heavy
  wins on profitability only with high utilization and process uniformity.
- Price headroom: identical-part spreads across EU providers run 4–5×
  (audit §4 benchmark, triangulated), so a Polish cost base (EUR 17.10/h
  manufacturing labour vs EUR 49.50 in Germany, 2025 FACT) can undercut every
  EU incumbent while holding ~40% margin.
- Entry economics: single HP MJF cell ~EUR 660k CAPEX, ~3.7-year payback at
  one machine; a Formlabs Fuse SLS cell at ~USD 57k is the rational pilot to
  validate PA12 demand first (audit §3.2).
- **Read:** don't sequence CNC/MJF strictly after "FDM succeeds" — FDM-only
  revenue may never fund the jump, and commodity FDM pricing is deflating.
  Validate PA12 demand early with a Fuse-class cell; keep FDM farm CAPEX
  small enough to write off (audit §8 mitigation).

### 3. Dual-use drones / C-UAS — verified, with a timing nuance

Market size (fresh, MarketsandMarkets anti-drone report, Jun 2025, FACT):

- Global C-UAS: USD 4.48B (2025) → USD 14.51B (2030), 26.5% CAGR.
- Europe: USD 1.24B (2025) → USD 4.16B (2030), 27.5% CAGR. Poland is a
  named country-level hotspot (layered radar/SIGINT/jamming procurement).

Policy stack (audit §5.2, FACT unless noted):

- EDIP in force (Council approval 8 Dec 2025): eligibility caps non-EU
  component cost at 35% of end product and requires EU design authority.
  EUR 1.5B 2026–27 work programme adopted 30 Mar 2026, incl. a EUR 100M FAST
  equity fund for defense startups/SMEs.
- SAFE (EUR 150B loans) disbursing since early 2026; Poland is the largest
  recipient at EUR 43.7B. Poland's 2026 defense budget ~PLN 200B, 4.8% of
  GDP — highest share in NATO.
- European Commission published an **Action Plan on Drone and Counter-Drone
  Security** (Feb 2026, FACT — ec.europa.eu defence-industry pages), putting
  C-UAS procurement on an EU-level policy track, not just national ones.

Demand at the startup layer (audit §5.2, FACT):

- Tytan Technologies flies 3D-printed interceptor airframes, scaling to
  3,000 units/month in a new Bavarian factory.
- Helsing uses 3D printing to cut HX-2 drone cost; Germany split ~EUR 900M
  of strike-drone contracts across STARK, Helsing, Rheinmetall.
- WB Group signed Poland's largest unmanned-systems contract, ~EUR 2.75B
  (Jun 2026).

The structural moat (audit §5.2, §6.2):

- The EDIP 35% origin cap does the marketing: buyers must document EU origin
  to keep eligibility, and a Chinese quote portal cannot sign that paper.
- Xometry's EU terms prohibit weapons parts by default; Protolabs' ITAR
  registration covers only US plants. The defense-attestable quick-turn niche
  in CEE is empty.
- Entry bar is lighter than feared: for prototype work, ISO 9001 + NDA + EU
  location + a no-China supply-chain attestation (ASSUMPTION, audit workbook;
  no public evidence contradicts it). AQAP 2110 / EN 9100 matters at
  serialization — roughly a 3–6 month upgrade from a working ISO 9001 system.

⚠️ Caution flag (audit §5.2): no public case study names a service bureau
supplying these companies, and the pattern (Tytan included) is to insource
production at scale. **The service window is prototype-to-early-serial —
roughly the first 2–3 years of each program.** Defense is a margin layer on
the same machines, not a standalone posture: alone, its certification and BD
cycles push meaningful revenue into years 2–3.

## The correction to the 1→2→3 sequence

The assumptions interlock rather than sequence:

- Drone/C-UAS parts are PA12 / MJF nylon (incl. CF grades) and machined
  aluminum — **FDM alone cannot serve that demand**. FDM's role is funnel and
  fixture/jig prototyping.
- The certification path has real lead time (ISO 9001 from day one → AQAP
  2110 from ~month 12), so the defense layer must start in parallel, not be
  "researched later."
- This is exactly the audit's recommended posture: P3 (DACH-nearshore speed
  play) as the operating model, P1's no-login front end as the funnel, P2
  (defense attestation) as the 50–60% gross-margin layer on the same
  machines.

## What this changes for us concretely

1. Keep the FDM instant-quote product as-is — it's the funnel, already
   validated against the mapi-tech/SeekMake baseline.
2. When adding processes (roadmap topic 16, `PROCESS_IDS` already anticipates
   it), prioritize **MJF/SLS PA12 (incl. PA12-CF) before CNC** — it maps
   directly onto drone airframe/payload demand and has the cheapest pilot
   path (Fuse-class cell).
3. Track ISO 9001 as a business task alongside the external prerequisites in
   `plans/engineering/ROADMAP.md` — it gates the P2 margin layer and takes
   months, not weeks.
4. Re-run the cheap prosumer validation (landing page + paid search) before
   any FDM farm CAPEX; the audit flags this as the gating unknown.

## Sources

- `research/eu-market/EU_on_demand_manufacturing_audit.docx` + workbook
  (14 Jul 2026) — all "audit [n]" references above; see its §9 for the
  numbered source list (Weerg filings, EDIP/SAFE legal texts, Eurostat,
  Wohlers/AMPOWER 2026, etc.).
- MarketsandMarkets, "Anti-Drone Market — Global Forecast to 2030" (Jun
  2025), marketsandmarkets.com/Market-Reports/anti-drone-market-177013645.html
  — market size, CAGR, Europe split, Poland country section.
- European Commission, DG Defence Industry and Space — EU defence industry
  pages incl. the Action Plan on Drone and Counter-Drone Security banner
  (accessed 17 Jul 2026).
- `research/competitors/mapi-tech-pricing.md` — SeekMake white-label and FDM
  minimum-price mechanics.
