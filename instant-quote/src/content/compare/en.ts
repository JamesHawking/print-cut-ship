// English copy for the comparison pages — must satisfy the pl.ts shape. Every
// zł amount and engine-derived percentage interpolates from CompareValues
// (no-literal-prices.spec.ts). Material claims trace to MATERIAL_DATA /
// catalog-static; cited external figures live in data.ts with footnotes.

import { formatPln } from '@/lib/format'
import type { CompareCopy } from './pl'
import type { CompareSlug } from './slugs'

const pln = (v: number) => formatPln(v, 'en')

export const enCompareCopy: Record<CompareSlug, CompareCopy> = {
  'asa-vs-petg': {
    metaTitle: 'ASA vs PETG — comparison with live prices | MICRO_FACTORY',
    metaDescription:
      'ASA and PETG side by side: UV, temperature, layer adhesion, tolerances and prices computed by the quoting engine. A decision in three sentences, not three paragraphs.',
    h1: 'ASA or PETG?',
    title: 'ASA vs PETG',
    teaser:
      'Outdoors and in heat ASA wins; with chemical contact and a tight budget — PETG.',
    verdict: (v) => [
      `A part living outdoors or above 70 °C → ASA: excellent UV resistance and a 98 °C HDT. A part touching oils and cleaning agents, printed cheaply and predictably → PETG: excellent layer adhesion and 50 MPa tensile strength. Price gap on the reference bracket: ${pln(v.petgBracket1Pln)} (PETG) vs ${pln(v.asaBracket1Pln)} (ASA) — ASA runs ~${v.asaOverPetgPct}% higher.`,
    ],
    intro: (v) => [
      `These are the two most commonly confused engineering filaments in FDM — both print reliably, both make functional parts, and yet the choice is rarely a coin flip. Below: hard numbers from our material card and prices computed by the same engine that quotes your files (rates of ${v.petgPlnPerKg} zł/kg for PETG and ${v.asaPlnPerKg} zł/kg for ASA).`,
    ],
    body: (v) => [
      'The physics of the decision is simple. ASA is a styrenic with excellent UV resistance and the higher heat deflection temperature (HDT 98 °C vs 70 °C) — a sensor housing on a façade or a bracket in an engine bay still looks and works like new after a year in the sun. PETG answers with higher tensile strength (50 MPa vs 40 MPa) and excellent interlayer adhesion, so a part loaded along the Z axis fails later than its ASA counterpart.',
      `On price, PETG always wins — the raw material costs ${v.petgPlnPerKg} zł/kg against ${v.asaPlnPerKg} zł/kg. On small parts the difference is symbolic (table above); on large housings it becomes material. If the part never sees sun or heat, the ASA premium buys you nothing.`,
    ],
    chooseA: {
      title: 'Choose ASA if…',
      items: [
        'the part lives outdoors — full sun, rain, frost',
        'operating temperature exceeds 70 °C (ASA HDT: 98 °C)',
        'color and surface must not yellow over the years',
        'you accept a ~2.4× higher material rate',
      ],
    },
    chooseB: {
      title: 'Choose PETG if…',
      items: [
        'the part contacts oils or cleaning agents',
        'interlayer strength matters (loads along the Z axis)',
        'you print a lot and budget matters',
        'the part works indoors, below 70 °C',
      ],
    },
    faq: [
      {
        q: 'Is PETG usable outdoors?',
        a: () =>
          'Short-term yes, long-term no — we rate PETG UV resistance as moderate: after seasons in the sun the surface dulls and mechanical properties drop. For permanent exposure pick ASA (UV resistance: excellent).',
      },
      {
        q: 'How much more expensive is ASA in practice?',
        a: (v) =>
          `On the reference bracket (20 cm³): ${pln(v.petgBracket1Pln)} for PETG vs ${pln(v.asaBracket1Pln)} for ASA at qty 1 — a ~${v.asaOverPetgPct}% gap. The bigger and more solid the part, the closer the gap gets to the rate ratio of ${v.petgPlnPerKg} to ${v.asaPlnPerKg} zł/kg.`,
      },
      {
        q: 'Which material is stronger?',
        a: () =>
          'In tension, PETG (50 MPa vs 40 MPa), and PETG has the excellent layer adhesion. ASA takes the lead back in heat: at 90 °C PETG is already past its 70 °C HDT and softening, ASA keeps working.',
      },
      {
        q: 'Do both materials print to the same accuracy?',
        a: () =>
          'Yes — we state the same ±0.3 mm / 100 mm tolerance and 1.2 mm minimum wall for both. The differences show up in service conditions, not in print geometry.',
      },
      {
        q: 'Why not just use PA12-CF?',
        a: () =>
          'If you need stiffness, temperature and dimensional stability all at once — yes, PA12-CF plays in a higher league (100 MPa, HDT 170 °C), but at ~7× the PETG rate. For typical housings and brackets that is overpaying.',
      },
    ],
    footnotes: [],
  },

  'pa-cf-vs-aluminum': {
    metaTitle:
      'Printed PA12-CF or machined aluminum? Costs and limits | MICRO_FACTORY',
    metaDescription:
      'When a printed PA12-CF bracket replaces a machined 6061 one — weight, cost at qty 1–50, lead time — and when the metal stays, no debate.',
    h1: 'Printed PA12-CF or machined aluminum?',
    title: 'PA12-CF vs aluminum',
    teaser:
      'A PA12-CF bracket can be 2.5× lighter and an order of magnitude cheaper in small batches — but it will not replace metal everywhere.',
    verdict: (v) => [
      `A mechanically loaded bracket, fixture or gripper at room temperature: printed PA12-CF costs ${pln(v.paCfBracket1Pln)} at qty 1 and ships in ${v.expressDays} business days — machined aluminum typically runs ${pln(v.aluBracketQty1MinPln)}–${pln(v.aluBracketQty1MaxPln)} and ${v.aluLeadMinDays}–${v.aluLeadMaxDays} business days at an EU job shop [2]. The polymer part is also ~2.5× lighter (density 1.08 vs 2.70 g/cm³). The metal stays when you need continuous service well above 100 °C, tolerances under ±0.1 mm, or electrical conductivity.`,
    ],
    intro: () => [
      'Carbon-filled PA12 is the stiffest material we run: 100 MPa tensile strength and a 170 °C HDT. That is enough to replace machined 6061 aluminum in many fixtures, measurement jigs and machine brackets — not everywhere, and not unconditionally. Below is the honest boundary between the two technologies, with numbers on both sides.',
    ],
    body: (v) => [
      'In absolute numbers, 6061-T6 aluminum remains stronger: 310 MPa against 100 MPa, with stiffness no polymer will match [1]. But a bracket rarely runs at its strength limit — it runs on stiffness at a given weight. At 1.08 g/cm³, a PA12-CF part of the same envelope weighs 40% of the aluminum one, and printed ribs and pockets cost nothing extra, while every milled pocket is spindle minutes.',
      `The economics are even starker: at 50 units you pay ${pln(v.paCfBracket50Pln)} per part — job shops typically get down to ${pln(v.aluBracketQty50MinPln)}–${pln(v.aluBracketQty50MaxPln)} at that point [2]. The limits are just as hard: continuous loaded service well above 100 °C, fits below ±0.1 mm (we state ±0.25 mm / 100 mm; CNC achieves ±0.05 mm [1]), and anywhere the part must conduct current or heat — the polymer is out by definition.`,
    ],
    chooseA: {
      title: 'Print PA12-CF if…',
      items: [
        'it is a bracket, fixture, jig or gripper, not a hot-zone component',
        'you need 1–50 units in days, not weeks',
        'weight matters: 1.08 vs 2.70 g/cm³',
        'the geometry is ribbed or organic — printing does not charge for complexity',
      ],
    },
    chooseB: {
      title: 'Stay with aluminum if…',
      items: [
        'the part runs continuously well above 100 °C under load',
        'fits require tolerances below ±0.1 mm',
        'electrical or thermal conductivity is required',
        'the batch runs into hundreds — CNC and casting take over',
      ],
    },
    faq: [
      {
        q: 'How much lighter is a PA12-CF part, really?',
        a: () =>
          'At identical geometry, ~2.5× (density 1.08 vs 2.70 g/cm³ [1]). In practice more — printing lets you add ribs and voids cheaply where milling would punish you for them.',
      },
      {
        q: 'What tolerances does printed PA12-CF hold?',
        a: () =>
          'We state ±0.25 mm / 100 mm. A CNC mill achieves ±0.05 mm [1]. Design critical fits with clearance, or plan to drill/ream holes after printing.',
      },
      {
        q: 'What about threads and bolted joints?',
        a: () =>
          'Threads cut directly in the polymer work fine at low loads; for anything serious use heat-set inserts — design-wise a standard pocket we print at no extra charge.',
      },
      {
        q: 'Where does the aluminum price range come from?',
        a: (v) =>
          `It is the typical quote range of EU CNC job shops for a reference-bracket-sized part: ${pln(v.aluBracketQty1MinPln)}–${pln(v.aluBracketQty1MaxPln)} at qty 1 [2]. We are citing someone else's market, not our own rate card — we do not offer machining.`,
      },
      {
        q: 'Will PA12-CF survive an engine bay?',
        a: () =>
          'The HDT is 170 °C, so short temperature peaks are not a problem. For continuous loaded service keep the polymer well below its HDT — for permanently hot zones the honest answer is: metal.',
      },
    ],
    footnotes: [
      '[1] Typical datasheet values for 6061-T6 aluminum: tensile strength ~310 MPa, density 2.70 g/cm³, milling tolerances per ISO 2768.',
      '[2] Typical price range of EU CNC job shops (3-axis, bracket-sized part ~80×60×30 mm, mid-2026). A cited external market, not our quote.',
    ],
  },

  'print-in-house-vs-order': {
    metaTitle:
      'Print in-house or order? An honest cost breakdown | MICRO_FACTORY',
    metaDescription:
      'Printer amortization, operator time and failed prints against the price of ordering. We run the numbers straight — including when NOT to order from us.',
    h1: 'Print in-house or order?',
    title: 'In-house vs ordering',
    teaser:
      'An honest ledger: when your own printer beats ordering — and when it only pretends to.',
    verdict: (v) => [
      `A one-off PLA print on a printer you already own costs ~${pln(v.inHouseHobbyPln)} in material and amortization — if your time is "free", we have nothing to sell you. Cost half an hour of work at ${v.operatorPlnPerHour} zł/h plus ${v.failureRatePct}% failed prints, and the same part comes to ~${pln(v.inHouseCostedPln)}, against ${pln(v.orderedBracketTotalPln)} ordered from us with shipping. Engineering materials, batches and deadlines push the ledger decisively toward ordering.`,
    ],
    intro: (v) => [
      `This page computes against our own business wherever the arithmetic says so. The assumptions are in the open: a ${pln(v.printerCostPln)} printer, a 5,000-print-hour service life, PLA at ${v.filamentPlaPlnPerKg} zł/kg, labor at ${v.operatorPlnPerHour} zł/h [1] and ${v.failureRatePct}% of prints in the bin [2]. Substitute your own numbers — the structure of the ledger does not change.`,
    ],
    body: (v) => [
      `The ledger for one part (a ~50 g bracket, 4 h of printing): material ${pln(v.inHouseMaterialPln)}, machine amortization ${pln(v.inHouseMachinePln)}, operator time ${pln(v.inHouseOperatorPln)} — slicing, starting, pulling off the plate, cleanup. Add ${v.failureRatePct}% waste: ~${pln(v.inHouseHobbyPln)} without labor, or ~${pln(v.inHouseCostedPln)} with it. The line item that dominates is not the plastic — it is the human.`,
      `Ordering the same part from us: ${pln(v.orderedBracketTotalPln)} gross with shipping (a single part tops up to the ${v.minOrderPln} zł order minimum — details on the pricing page). Against hobby "my time doesn't count" math, your printer wins and we say so plainly. The ledger flips when ASA or PA12-CF enters (enclosure, drying, tuned profiles), when you need a dozen parts at repeatable quality, or when a deadline is somebody's commitment.`,
    ],
    chooseA: {
      title: 'Print in-house if…',
      items: [
        'you already own a printer and print time costs nobody anything',
        'PLA or PETG at "good enough for me" quality is sufficient',
        'you iterate a prototype several times a day',
        'a single failed part breaks nothing',
      ],
    },
    chooseB: {
      title: 'Order if…',
      items: [
        'the part must be ASA, PA12-CF or another material demanding an enclosure and drying',
        'you need a batch at repeatable quality, not individual lucky prints',
        'the deadline is a commitment, not a hope',
        'an hour of your work costs more than the price difference',
      ],
    },
    faq: [
      {
        q: 'Is 10% failed prints an exaggeration?',
        a: () =>
          'For a dialed-in PLA profile — often less. For new materials, first geometry iterations and printers without an enclosure — often more. We take 10% as an honest average [2]; substitute your own value, the structure of the ledger stays the same.',
      },
      {
        q: 'When does an in-house printer make sense for a company?',
        a: (v) =>
          `When you print regularly and someone genuinely owns the machine. The hardware is ${pln(v.printerCostPln)}, but time makes the ledger: at a few prints a month ordering is cheaper; at daily prototyping — your own printer, plus ordering the engineering parts.`,
      },
      {
        q: 'Why not count electricity and spare parts?',
        a: () =>
          'We fold them into the amortization line — at this cost scale, power and nozzles move the result by single groszy per part. The line that actually decides is operator time.',
      },
      {
        q: 'If you are more expensive for PLA, why publish this page?',
        a: () =>
          'Because we would rather you knew before ordering. Our advantage starts at engineering materials, batches and deadlines — and we prefer a customer who returns with that job over one disappointed by a one-off PLA part.',
      },
    ],
    footnotes: [
      '[1] Street prices and rates for Poland, mid-2026: an enclosed desktop printer with accessories, a 1 kg PLA spool, a fully-loaded engineering hour.',
      '[2] Estimated share of failed or discarded prints in office/hobby printing without constant supervision.',
    ],
  },
}
