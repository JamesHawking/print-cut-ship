// English copy for the material landing pages — must satisfy the same
// Record shape as pl.ts (a missing material or field is a compile error).

import type { PublishedMaterialId } from './slugs'
import type { MaterialCopy } from './pl'

export const enMaterialsCopy: Record<PublishedMaterialId, MaterialCopy> = {
  petg: {
    metaTitle:
      'PETG 3D printing service — durable parts on demand | MICRO_FACTORY',
    metaDescription:
      'PETG 3D printing: ~50 MPa tensile, excellent layer adhesion, moisture resistance. Quote in seconds, parts ship in 3 business days, D+1 delivery PL/DE.',
    h1: 'PETG 3D printing service',
    promise:
      'PETG is our first-choice material for functional parts: roughly 50 MPa tensile strength, excellent layer adhesion and moisture resistance, without the processing quirks of ABS. Parts ship in 3 business days (standard lead time) with D+1 delivery in Poland and Germany, D+2 across the rest of the EU — no account, no minimum batch.',
    useCases: [
      'Electronics enclosures and mounting panels',
      'Brackets, fixtures and machine elements used indoors',
      'Guides, covers and gripper elements in automation',
      'Functional prototypes tested under real load',
      'Parts exposed to moisture — ducts, sensor housings, small reservoirs',
    ],
    guidelines: [
      'Minimum wall thickness is 1.2 mm; thinner walls lose stiffness and can show through. For load-bearing features we recommend 2.4 mm — two full perimeters per side.',
      'Dimensional tolerance is ±0.3 mm per 100 mm. Design press-fit holes 0.2 mm oversize, or plan to ream after printing.',
      'Bridges longer than ~8 mm need supports, and supports leave witness marks. Orient visible surfaces upward and keep overhangs under 45°.',
      'PETG layer adhesion is good enough that Z-axis loading only costs about 20–30% of strength — still, orient primary stresses in the XY plane.',
    ],
    finishes: [
      'Support removal and edge cleanup as standard',
      'Smoothed mating surfaces (mounting planes)',
      'Brass threaded inserts on request',
    ],
    faq: [
      {
        q: 'How does PETG differ from PLA?',
        a: 'PETG is more heat-resistant (HDT ~70 °C vs ~55 °C for PLA), less brittle, and does not degrade with moisture. Keep PLA for concept models; pick PETG for parts that have to work.',
      },
      {
        q: 'Is PETG suitable outdoors?',
        a: 'Short-term yes, but months of UV exposure yellow it and cost impact strength. For permanent outdoor use we recommend ASA — see the comparison below.',
      },
      {
        q: 'What is the maximum part size?',
        a: 'The build envelope is 340 × 320 × 340 mm. Larger parts are split into segments for bonding or bolting; the quote form automatically flags a part that does not fit the plate.',
      },
      {
        q: 'Can PETG parts touch food?',
        a: 'The raw resin can be certified, but FDM printing leaves micro-gaps between layers where bacteria settle. We do not recommend FDM parts for repeated, direct food contact.',
      },
      {
        q: 'How smooth is the surface?',
        a: 'We print 0.2 mm layers as standard — layer lines are visible and tactile. Functional surfaces hold ±0.3 mm; cosmetic finishing (sanding, painting) is up to the recipient.',
      },
      {
        q: 'What does PETG printing cost?',
        a: 'Price follows weight and machine time — the table above shows reference prices computed by the same engine as the quote form. Fastest answer: upload your own file and see the price in seconds.',
      },
    ],
  },
  asa: {
    metaTitle:
      'ASA 3D printing service — UV and weather resistant parts | MICRO_FACTORY',
    metaDescription:
      'ASA 3D printing: excellent UV resistance, 98 °C HDT, color-stable outdoors. Instant quote, parts ship in 3 business days, D+1 delivery PL/DE.',
    h1: 'ASA 3D printing service',
    promise:
      'ASA is the material for parts that have to survive outside: it does not yellow under UV, takes 98 °C heat deflection, and keeps its impact strength in freezing weather. Choose it wherever PETG eventually gives up. Parts ship in 3 business days (standard lead time), D+1 in PL/DE, D+2 across the rest of the EU.',
    useCases: [
      'Housings for outdoor-mounted devices — sensors, cameras, gate hardware',
      'Automotive plugs, brackets and covers (away from direct heat sources)',
      'Mounts for PV installations, antennas and lighting',
      'Tool housings and garden equipment',
      'Machine parts in sunlit halls and near windows',
    ],
    guidelines: [
      'Minimum wall thickness is 1.2 mm; ASA shrinks more than PETG, so design large flat areas with ribs instead of solid thick walls.',
      'Dimensional tolerance is ±0.3 mm per 100 mm; add shrinkage allowance on long, thin features.',
      'Layer adhesion is good but clearly below PETG — parts loaded along Z get oriented at quoting time; note the load direction in your order comments if it is critical.',
      'Sharp internal corners concentrate stress; use radii ≥ 1 mm, and prefer inserts over threading directly into the material for screwed joints.',
    ],
    finishes: [
      'Support removal and edge cleanup as standard',
      'Matte surface, color-stable outdoors',
      'Brass threaded inserts on request',
    ],
    faq: [
      {
        q: 'ASA or ABS — which one?',
        a: 'ASA is the outdoor successor to ABS: similar mechanics and temperature range, without the UV yellowing and chalking. Anywhere you used to spec ABS outdoors, spec ASA today.',
      },
      {
        q: 'How long does an ASA part last in the sun?',
        a: 'ASA is UV-stabilized — it holds color and impact strength for years, not months. It is the material used factory-side for car mirror housings and outdoor enclosures.',
      },
      {
        q: 'How much heat can ASA take?',
        a: 'HDT is about 98 °C (0.45 MPa). A part keeps its shape in a hot car interior or on a sunny façade; it does not belong next to an exhaust manifold — look at PA12-CF there.',
      },
      {
        q: 'Can ASA be painted and glued?',
        a: 'Yes — ASA bonds with ABS adhesives (including solvent types) and takes paint well after keying the surface. For serviceable joints we recommend threaded inserts.',
      },
      {
        q: 'Is ASA stiffer than PETG?',
        a: 'Comparable: ASA is around 40 MPa tensile vs ~50 MPa for PETG, but with clearly better heat and UV resistance. Indoors PETG usually wins; outdoors, ASA.',
      },
      {
        q: 'What does ASA printing cost?',
        a: 'The table above shows reference prices computed by the quoting engine (ASA runs about 2× PETG per kilogram). Upload a file and you get your part’s price instantly.',
      },
    ],
  },
  pa12_cf: {
    metaTitle:
      'PA12-CF 3D printing service — carbon fiber nylon | MICRO_FACTORY',
    metaDescription:
      'Carbon-fiber PA12: ~100 MPa, 170 °C HDT, machined-part stiffness at a fraction of the weight. Jigs, fixtures and end-use parts in 3 business days.',
    h1: 'PA12-CF 3D printing service',
    promise:
      'PA12-CF is our strongest material: carbon-fiber-reinforced nylon at roughly 100 MPa tensile and heat resistance to 170 °C. Where you used to mill aluminium or POM, a print is often enough — at a fraction of the weight, with no machining setup cost. Ships in 3 business days, D+1 in PL/DE, D+2 across the rest of the EU.',
    useCases: [
      'Robot grippers, fingers and end-effector tips',
      'Production tooling: jigs, fixtures, gauges',
      'Gears, cams and levers working under load',
      'Drone and motorsport components — stiff, light, heat-tolerant',
      'Spare parts for machines nobody manufactures anymore',
    ],
    guidelines: [
      'Minimum wall thickness is 1.0 mm; carbon fiber stiffens the extruded paths, so thin ribs carry more than in unfilled materials.',
      'The composite is strongly anisotropic: full stiffness along the paths (XY), roughly half between layers (Z). State the primary load direction in your order comments — we will orient the part on the plate accordingly.',
      'Tolerance is ±0.25 mm per 100 mm; PA12 absorbs far less moisture than PA6, so dimensions stay stable in humid environments too.',
      'Make threads with heat-set brass inserts — threads cut directly into the composite shear out under repeated assembly.',
      'The surface is matte, dark graphite; if the part rubs against softer plastics, plan a bushing or liner — carbon fill is abrasive.',
    ],
    finishes: [
      'Support removal and edge cleanup as standard',
      'Matte, uniform carbon finish',
      'Heat-set brass inserts on request',
    ],
    faq: [
      {
        q: 'Can PA12-CF replace an aluminium part?',
        a: 'Often, yes — the specific stiffness (stiffness per weight) of a CF print approaches machined aluminium, at a fraction of CNC cost and lead time. The limits are temperatures above ~170 °C and precision fits below ±0.1 mm.',
      },
      {
        q: 'Does the material conduct electricity?',
        a: 'No — the carbon fibers are short and embedded in nylon; the part remains an insulator. It is not ESD-safe either; if you need charge dissipation, contact us before ordering.',
      },
      {
        q: 'How does PA12-CF handle moisture?',
        a: 'PA12 absorbs several times less water than the common PA6 — parts hold their dimensions and stiffness outdoors and in humid halls. We print from continuously dried granulate.',
      },
      {
        q: 'Can it be machined after printing?',
        a: 'Yes: drilling, reaming and insert-threading work well. Use carbide tooling — the carbon fill dulls plain tool steel quickly.',
      },
      {
        q: 'Why is it clearly more expensive than PETG and ASA?',
        a: 'The granulate costs several times more, prints slower, and wears nozzles. The table above shows exactly how that lands on part price — computed by the same engine as the quote form.',
      },
      {
        q: 'When is plain PA12 or PETG the better pick?',
        a: 'If the part has to flex (snap-fits) or take impacts, a stiff composite can be too brittle — unfilled nylon or PETG serves better. Tell us what the part does and we will advise.',
      },
    ],
  },
}
