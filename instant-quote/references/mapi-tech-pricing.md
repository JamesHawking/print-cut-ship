# mapi-tech.pl — inferred pricing rules

Competitor research, captured 2026-07-14 from the public quote widget on
<https://mapi-tech.pl/>. This is a Polish FDM-only 3D-printing service.

## How they quote (architecture)

They do **not** run their own quoting engine. The "Natychmiastowa wycena online"
widget is a white-label embed of **SeekMake** (`seekmake.com`), loaded via
`https://seekmake.com/assets/public/iq-api-latest.js` and rendered from
`https://seekmake.com/instant-quote/?isEmbed=true&manufacturer=69ca8d2ac239a7f29a4e9f87`.
The full pricing config (machines, materials, multipliers, minimums) is delivered
to the browser and cached in `localStorage.instantQuote`; the final price string is
computed server-side from a custom per-machine formula that is *not* exposed to the
client, so the numbers below are the config inputs plus empirically observed outputs,
not the exact formula.

The site itself is WordPress + WooCommerce + Elementor; the shop and blog are
separate. Currency shown is PLN (gross, Polish VAT context).

## Pricing model (structure)

Price is computed **per part** from a slicer pass (SeekMake slices the uploaded mesh
to get weight, print time, layer count, print area) and then:

- material cost driven by **weight** (volume x density x infill/walls), and
- machine cost driven by **print time (hours) x price-per-hour**,
- multiplied by a per-material **factor**,
- multiplied by a **lead-time** multiplier,
- then floored to a **minimum part price**, and the order floored to a **minimum order**.

Margin (`marginMachine`) is set to 0 on every machine — margin is baked into the
per-kg and per-hour rates rather than added as a separate markup.

### Minimums (these dominate small parts)

- **Minimum order value: 30 PLN** (global `priceMin`).
- **Minimum part price**, varies by machine profile:
  - FDM 0.8 mm nozzle (large prints): 10 PLN/part, config min 40 PLN
  - FDM 0.2 mm nozzle (detailed prints): 1.5 PLN/part, config min 35 PLN
  - FDM generic: 1.5 PLN/part, config min 30 PLN

### Lead time (multiplier x calendar target)

| Option | Polish label | Multiplier | Target |
|---|---|---|---|
| Express | Ekspres | **1.30** | 3 days |
| Standard (default) | Standard | **1.00** | 5 days |
| Not urgent | Nie pilne | **0.90** | 10 days |

Site also advertises "Dostawa w ciągu 24–48h" as a headline claim.

### Infill options (feed weight/time, default 20%)

Light 15%, **Standard 20% (default)**, Medium 30%, Strong 40%, Solid 60%,
Durable 80%, Full 100%. (A separate legacy `infill` variable also carried
price multipliers: 10% -> x1.10, 20% -> x1.22, etc.)

### Precision / layer height (default 0.24 mm)

Balanced 0.24 mm (default), Standard 0.32 mm, Draft 0.40 mm.

### Colors

Black (#000000), White (#ffffff), Gray (#898989) as the base palette; individual
materials carry their own color lists (PLA has 7).

### Build volume

320 x 320 x 320 mm (surfaceMachine on the FDM profiles); marketed as "320³".

## Materials (price per kg, density, factor)

Extracted from the seven machine profiles. `factor` is a per-material price
multiplier applied on top of the base formula. Prices are PLN/kg.

| Machine profile | PLN/h | Material | PLN/kg | Density (g/cm³) | Factor |
|---|---|---|---|---|---|
| P2S | 1.80 | PLA | 50 | 1.25 | 1.0 |
| P2S PETG | 2.25 | PETG | 50 | 1.27 | 1.2 |
| P2S PETG | 2.25 | PCTG | 150 | 1.23 | 1.0 |
| P2S ABS/ASA | 2.50 | ASA | 120 | 1.05 | 1.5 |
| P2S ABS/ASA | 2.50 | ASA CF | 190 | 1.12 | 1.0 |
| P2S Iglidur | 3.50 | Iglidur I150PF | 550 | 1.30 | 1.0 |
| P2S Iglidur | 3.50 | Nylon 12 CF / PA12 CF | 350 | 1.08 | 2.0 |
| P2S PETG FR | 2.50 | PETG V0 (self-extinguishing) | 180 | 1.03 | 1.0 |
| P2S PLA 0,2 mm | 2.25 | PLA | 50 | 1.30 | 1.0 |
| P2S PLA 0,2 mm | 2.25 | PETG | 60 | 1.25 | 1.0 |
| P2S PLA 0,2 mm | 2.25 | Iglidur I150PF | 450 | 1.30 | 1.0 |
| P2S 0,8 mm | 2.00 | PLA | 50 | 1.25 | 1.0 |
| P2S 0,8 mm | 2.00 | PETG | 60 | 1.25 | 1.0 |

Startup cost is 0 on all materials. The public materials section also lists
"coming soon" grades (Iglidur I180PF/I190PF, PLA HT150, PETG FR) not yet priced.

Effective machine hourly rate is low (roughly 1.8–3.5 PLN/h) — the real revenue on
small parts comes from the minimums, not the per-hour/per-gram rate.

## Empirical anchor (verified in the widget)

Uploaded a solid 20 mm cube (8 cm³) in PETG, default settings. SeekMake's slicer
returned: weight **2.03 g**, print time **2.09 h**, 101 layers, print area 2400 mm².
Raw computed price **≈1.21 PLN**, floored up to the **1.5 PLN** minimum part price.
So a typical small part is priced entirely by the minimums; per-part unit cost only
starts tracking weight/time once parts get large (a 50 mm cube slices to ~129 g /
~33 print-hours).

## Takeaways for our instant-quote prototype

- They lead on **speed + convenience** ("Najwygodniejsza usługa druku 3D w Polsce",
  24–48h, quote "gotowa w kilka sekund"), FDM-only, PLN, Poland domestic.
- Their moat is a **broad, well-explained material catalogue** (PLA -> ASA -> PA12-CF
  -> Igus Iglidur sliding-bearing grades) with per-material HDT/UV/strength cards.
- Pricing is **time + weight + per-material factor + lead-time multiplier**, floored
  by aggressive **minimums (30 PLN order / 1.5–10 PLN part)** — the opposite of our
  volume-times-rate model. Our €0.40/cm³-style MJF pricing is a different process
  (powder vs FDM) so the numbers are not directly comparable, but their **lead-time
  multipliers (0.90 / 1.00 / 1.30)** and **minimum-order floor** map onto levers we
  already have in `pricing-config.ts`.
- They buy the quoting engine (SeekMake) rather than build it — our from-scratch
  parser + pricing engine is the differentiator if we go to market.
