// English dictionary — must satisfy the Dictionary type inferred from pl.ts.
// Adding a key to one locale without the other is a compile error.

import type { components } from '@/lib/api/schema'
import { formatDecimal } from '@/lib/format'
import type { Dictionary } from './types'
import type { MaterialFamily } from './pl'
import { enPlural } from './plural'

// Derived from the generated contract, like pl.ts.
type OrderStatus = components['schemas']['OrderSummary']['status']
type DfmCode = components['schemas']['DfmFlag']['code']
type ApiErrorCode = components['schemas']['ApiErrorCode']
type ProcessId = components['schemas']['ProcessId']

type Params = Record<string, unknown>

const num = (v: unknown): string => {
  if (typeof v === 'number') return formatDecimal(v, 'en', 2)
  return typeof v === 'string' ? v : '—'
}

export const en = {
  meta: {
    title: 'Instant 3D printing quote — upload, price, order | MICRO_FACTORY',
    description:
      'Upload an STL, 3MF, OBJ or STEP file and get an instant price. Made in the EU, ships D+1/D+2 to Germany. No account needed.',
    quote: {
      title: 'Your quote | MICRO_FACTORY',
      description:
        'Pick material, quantity and lead time — the price updates live.',
    },
    login: {
      title: 'Track your order | MICRO_FACTORY',
      description:
        'Access your orders with a one-time code — no account, no password.',
    },
    orders: {
      title: 'Your orders | MICRO_FACTORY',
      description: 'Quote and order history linked to your email address.',
    },
    orderStatus: {
      title: 'Order status | MICRO_FACTORY',
      description:
        'Live payment, production and shipping status of your order.',
    },
    pay: {
      title: 'Test payment | MICRO_FACTORY',
      description: 'Payment placeholder in test mode.',
    },
  },
  hero: {
    wordmark: 'MICRO_FACTORY',
    status: 'EU · FDM · PLN',
    kickerBadge: 'EU',
    kicker: 'On-demand 3D printing · Poland · PLN',
    // The headline literally labels the console's two chambers below it:
    // file goes in the left side, the price comes out the right.
    headline1: 'File in.',
    headline2: 'Price out.',
    sub: 'One machine below: your file goes in on the left, the itemized price comes out on the right. VAT included, and a ship date it will keep.',
    console: {
      title: 'Instant quote',
      status: (file: string) => `engine live · showing ${file}`,
      intakeHeading: 'What do you want to print?',
      ownTitle: 'My own design',
      ownHint: 'Drop it anywhere here — STL · 3MF · OBJ · STEP',
      linkTitle: 'Something I found online',
      linkHint: 'Paste a MakerWorld model link',
      linkButton: 'Paste link',
      finePrint:
        'Up to 100 MB · used only for the quote — deleted automatically if you don’t order',
      demoCaption: 'Your quote appears here — this one is the demo bracket',
      printable: 'printable',
      metaShip: (weekday: string) => `incl. VAT · ships ${weekday} · D+1 PL/DE`,
      metaShipFallback: 'incl. VAT · ships D+1 PL/DE',
      rowMaterial: (weight: string, material: string) =>
        `Material · ${weight} g ${material}`,
      rowMachine: (hours: string) => `Machine time · ${hours} h`,
      // Informational, not additive: gross prices, VAT extracted.
      rowVat: 'incl. VAT 23%',
      replay: 'Replay demo',
      locked: 'price locked 14 days',
    },
  },
  nav: {
    howItWorks: 'How it works',
    materials: 'Materials',
    pricing: 'Pricing',
    compare: 'Compare',
    blog: 'Knowledge base',
    trackOrder: 'Track order',
    menuLabel: 'Toggle menu',
    skipToContent: 'Skip to content',
    resume: (n: number) => `Resume quote (${n}) →`,
    // Narrow-desktop form of `resume` (1024–1280px, PL labels are long).
    resumeShort: (n: number) => `Quote (${n}) →`,
    newQuote: '← New quote',
    // Header upload CTA (empty cart) — full label at xl+, short form in the
    // tight band and as the mobile menu's primary button. Opens the native
    // file picker, same funnel as QuoteCta.
    getQuote: 'Price a part',
    getQuoteShort: 'Price',
    // Quote-page "New quote" confirmation (AlertDialog) — orange, not red:
    // the parts are discarded, nothing is "wrong".
    newQuoteConfirmTitle: 'Start a new quote?',
    newQuoteConfirmBody: (n: number) =>
      `Continue? ${n} ${enPlural(n, 'part', 'parts')} will be discarded.`,
    newQuoteConfirmAction: 'New quote',
    newQuoteConfirmCancel: 'Cancel',
  },
  ticker: [
    'Ships D+1 PL/DE',
    'Free shipping ≥ 500 zł',
    'No account',
    'Made in the EU',
  ],
  process: {
    n: '01',
    heading: 'File to ship date in three steps',
    intro:
      'From upload to ship date in under a minute: we measure your file, price it, and lock the date. Below is a real run on the live quoting engine.',
    steps: [
      { n: '01', kicker: 'UPLOAD', title: 'Drop the file' },
      { n: '02', kicker: 'PRICE', title: 'Read the numbers' },
      { n: '03', kicker: 'ORDER', title: 'Lock the date' },
    ],
    ships: 'SHIPS',
    // "D+1" is the courier-transit claim from the ticker; the weekday is the
    // engine's real express ship date (GET /api/v1/ship-dates).
    shipsDate: (weekday: string) => `${weekday} · D+1`,
    shipsDateFallback: 'D+1',
    shipsCutoff: 'PL / DE · 14:00 cutoff',
    // The live demo run's machine log (buildScript in how-it-works/demo.ts).
    // Every number arrives pre-formatted per locale; the PRICE line is the
    // real engine answer. Log tags stay untranslated — it's a machine log.
    demo: {
      cmd: (file: string) => `$ quote ${file}`,
      tags: {
        recv: 'RECV',
        measure: 'MEASURE',
        price: 'PRICE',
        order: 'ORDER',
        ship: 'SHIP',
        done: 'DONE',
      },
      recv: (file: string, size: string) => `${file} · ${size}`,
      measureMesh: (triangles: string) =>
        `${triangles} triangles · watertight OK`,
      measureDims: (volume: string, dims: string) => `${volume} · ${dims}`,
      priceConfig: 'PETG · 1 pc · standard',
      priceResult: (total: string, weight: string, hours: string) =>
        `${total} incl. VAT · ${weight} g · ${hours} h print`,
      order1: 'no account · no sales call',
      order2: 'ship date locks at checkout',
      ship: (weekday: string) => `${weekday} · D+1 · PL/DE · 14:00 cutoff`,
      shipFallback: 'D+1 · PL/DE · 14:00 cutoff',
      done: 'quote complete',
      replay: 'Replay',
      engineLabel: 'quote-engine v1',
      panelTag: 'Live quote run',
      meshLabel: (triangles: string) => `mesh · ${triangles} triangles`,
      cta: 'Now run yours →',
      srSummary: (total: string, weekday: string) =>
        `A sample bracket measured in the browser and priced by the live engine at ${total} incl. VAT, shipping ${weekday}, D+1 to PL/DE.`,
    },
  },
  materialsSection: {
    n: '02',
    heading: (count: number) => `${count} materials, prototype to end-use`,
    material: 'Material',
    application: 'Application',
    density: 'Density',
    from: 'From',
    footnote: 'Rates gross incl. 23% VAT',
    readGuide: 'Guide',
    guideSoon: 'Guide soon',
    // Mega-menu badge (nav-panels.tsx) — the full label would overflow the
    // two-column panel's cell.
    guideSoonShort: 'Soon',
    bracketLabel: 'demo bracket · 1 pc',
  },
  materialFamilies: {
    standard: 'Standard',
    engineering: 'Engineering',
    specialty: 'Specialty',
  },
  materials: {
    pla: {
      family: 'standard' as MaterialFamily,
      tagline:
        'Cheapest and easiest to print. Prototypes, concept models, display parts.',
    },
    petg: {
      family: 'standard' as MaterialFamily,
      tagline:
        'Tough, moisture-resistant workhorse. Enclosures, brackets, functional parts.',
    },
    pctg: {
      family: 'standard' as MaterialFamily,
      tagline:
        'Upgraded PETG with higher impact resistance. Housings and mechanical parts.',
    },
    asa: {
      family: 'engineering' as MaterialFamily,
      tagline:
        'UV- and weather-stable. Outdoor, automotive and exterior parts.',
    },
    petg_fr: {
      family: 'specialty' as MaterialFamily,
      tagline:
        'Flame-retardant (UL94 V-0). Electronics enclosures and control cabinets.',
    },
    pa12_cf: {
      family: 'engineering' as MaterialFamily,
      tagline:
        'Carbon-filled nylon — peak strength, heat resistance to ~170°C. Jigs, gears, motorsport.',
    },
    iglidur: {
      family: 'specialty' as MaterialFamily,
      tagline:
        'Self-lubricating Igus material. Bearings, bushings and sliding parts.',
    },
  },
  pricing: {
    n: '03',
    heading: 'The price is a formula, not a negotiation',
    formulaLead: 'PRICE',
    // Rendered as: PRICE = MATERIAL (…) + MACHINE (…) × QTY (…) × LEAD (…)
    terms: [
      { op: '=', name: 'MATERIAL', unit: '(g × zł/kg)' },
      { op: '+', name: 'MACHINE', unit: '(h × zł/h)' },
      { op: '×', name: 'QTY', unit: '(−5…28%)' },
      { op: '×', name: 'LEAD', unit: '(−10…+30%)' },
    ],
    cards: [
      {
        title: 'Weight, like a slicer',
        body: 'A 0.9 mm shell over your part’s surface plus 20% infill, converted to grams by material density.',
      },
      {
        title: 'No hidden fees',
        body: '1 zł order fee, 30 zł minimum order, 20 zł flat shipping — free above 500 zł. That’s the whole list.',
      },
      {
        title: 'Itemized, always',
        body: 'Every quote shows material, machine time and adjustments as separate lines — gross, incl. 23% VAT.',
      },
    ],
  },
  // Landing FAQ (section 04) — mirror of pl.ts.
  landingFaq: {
    n: '04',
    heading: 'Frequently asked questions',
    items: [
      {
        q: 'What happens to my file?',
        a: 'The file lands on our EU server only to prepare your quote. If you never order, it is deleted automatically. Nobody reviews it and we never share it.',
      },
      {
        q: 'How can the price be instant?',
        a: 'Your browser measures the geometry and the same engine that prices orders does the math — slicer-style weight plus machine time. At checkout the engine recomputes everything from the stored file, so the price can never drift from the model.',
      },
      {
        q: 'What accuracy should I expect?',
        a: 'Typically ±0.3 mm per 100 mm in the XY plane — what a well-tuned FDM machine delivers. If a part needs tighter fits, design in clearance or plan to post-machine the interfaces.',
      },
      {
        q: 'How fast will my order arrive?',
        a: 'Standard lead is 3–10 business days, express is faster. Orders placed by 14:00 enter production the same day; the courier delivers D+1 in PL/DE and D+2 across the rest of the EU.',
      },
      {
        q: 'Do I need an account?',
        a: 'No. Quoting is anonymous and ordering only needs an email — you get a confirmation and a one-time code to track status. No password, no sales rep.',
      },
      {
        q: 'What does shipping cost?',
        a: 'A flat 20 zł EU-wide, free on orders of 500 zł or more. Minimum order is 30 zł — every price is gross, incl. 23% VAT.',
      },
    ],
  },
  footer: {
    note: 'Every quote fully itemized · no hidden fees',
    meta: 'EU · FDM · PLN · 23% VAT',
    cutoff: '14:00 cutoff',
    navLabel: 'Navigate',
    orderLabel: 'Order',
    contactLabel: 'Contact',
  },
  notFound: {
    tag: 'Error 404',
    heading: 'Page not found',
    body: "This address doesn't match any page. Check the spelling or start from one of the links below.",
    linksLabel: 'Try instead',
    home: 'Home',
  },
  // Material landing pages — UI chrome only; long-form prose lives in
  // src/content/materials/{pl,en}.ts.
  materialsPages: {
    breadcrumbHome: 'Home',
    breadcrumbMaterials: 'Materials',
    indexTitle: '3D printing materials — prices & properties | MICRO_FACTORY',
    indexDescription:
      'FDM materials from prototype to end-use: properties, design limits, and prices computed by the quoting engine.',
    indexHeading: '3D printing materials',
    indexIntro:
      'Every material prints on the same machines and is priced by the same engine as the quote form. Pick a material for properties, design guidance, and reference prices.',
    priceFrom: (price: string) => `from ${price}`,
    comingSoon: 'Page coming soon',
    propertiesTitle: 'Properties',
    detailsLink: 'Details →',
    datasheetTitle: 'Datasheet — printed, XY',
    densityRate: 'Density · rate',
    shipsIn: (days: number) => `ships in ${days} business days`,
    propertyLabelsShort: {
      tensile: 'Tensile',
      hdt: 'HDT',
    },
    propertyLabels: {
      tensile: 'Tensile strength',
      hdt: 'Heat deflection (HDT)',
      uv: 'UV resistance',
      layerAdhesion: 'Layer adhesion',
      minWall: 'Min wall thickness',
      tolerance: 'Dimensional tolerance',
      density: 'Density',
      rate: 'Material rate',
    },
    ratings: {
      excellent: 'excellent',
      good: 'good',
      moderate: 'moderate',
      low: 'low',
    },
    pricesTitle: 'Reference prices',
    pricesNote:
      'Live prices — calculated by the same engine as your quote. Gross incl. 23% VAT, standard lead time.',
    priceHeaderPart: 'Reference part',
    priceHeaderQty: (n: number) => `Qty ${n}`,
    partNames: {
      bracket: 'Bracket',
      enclosure: 'Enclosure',
      housing: 'Housing',
    },
    useCasesTitle: 'Use cases',
    guidelinesTitle: 'Design guidelines',
    faqTitle: 'FAQ',
    compareTitle: 'Compare with',
    pricingLink: 'How we price →',
    allMaterialsLink: 'All materials →',
  },
  // Pricing page — UI chrome only; prose in src/content/pricing.
  pricingPage: {
    breadcrumb: 'Pricing',
    feeMinOrder: 'Minimum order',
    feeOrderFee: 'Order fee',
    feeShipping: (thresholdPln: number) =>
      `Shipping · free ≥ ${thresholdPln} zł`,
    feeVat: 'VAT included',
    sliderTitle: 'Quick estimate by volume',
    sliderLabel: (volume: string) => `Part volume: ${volume} cm³`,
    sliderNote:
      'Unit price, standard lead time, idealized cube geometry — quote your real part through the form.',
    formulaTitle: 'The formula',
    headerFactor: 'factor',
    rateCardTitle: 'Rates & reference prices',
    rateCardVolumeHeader: (volume: number) => `${volume} cm³`,
    discountsTitle: 'Quantity discounts',
    headerDiscount: 'Discount',
    headerLine: 'Line total',
    discountExampleLabel: (part: string) =>
      `Worked example: ${part} 60 cm³, PETG`,
    leadTimesTitle: 'Lead times',
    headerMultiplier: 'Multiplier',
    orderedLabel: (weekday: string, time: string) =>
      `Ordered: ${weekday}, ${time}`,
    shipsLabel: (lead: string, days: number, weekday: string, weeks: number) =>
      `${lead} · ${days} business days → ships ${weekday}${
        weeks === 1 ? ' next week' : weeks >= 2 ? ' in two weeks' : ''
      }`,
    minimumsTitle: 'Minimums & shipping',
    minOrderExampleTitle: 'When the minimum binds',
    fullRateCardLink: 'Full rate card →',
    noHiddenTitle: 'No hidden costs',
    comparisonTitle: 'An honest comparison',
    faqTitle: 'Pricing FAQ',
    seeAlso: 'See also',
  },
  comparePages: {
    breadcrumb: 'Comparisons',
    indexTitle: 'Material and technology comparisons | MICRO_FACTORY',
    indexDescription:
      'ASA or PETG, printed PA12-CF or CNC aluminum, your own printer or ordering — settled with numbers, not adjectives.',
    indexHeading: 'Comparisons',
    indexIntro:
      'The three decisions we help with most often. The numbers come from our material card and quoting engine — where we cite someone else’s market, we say so plainly.',
    verdictTitle: 'The short answer',
    readVerdict: 'Read the verdict →',
    // Landing teaser card for the comparisons hub (GuidesTeaser.tsx).
    teaserTitle: 'ASA or PETG? Your own printer or ordering?',
    // Mega-menu panel footer (header/nav-panels.tsx).
    allComparisonsTitle: 'All comparisons',
    higherBetter: 'higher is better',
    lowerBetter: 'lower is better',
    tileStatAsa: (hdtC: number) => `${hdtC} °C · UV+`,
    tileStatPetg: (mpa: number, ratePlnPerKg: number) =>
      `${mpa} MPa · ${ratePlnPerKg} zł/kg`,
    tilePrintedQty1: 'Printed · qty 1',
    tileCncQty1: 'CNC · qty 1 [2]',
    tileInHouse: 'In-house, costed',
    tileOrdered: 'Ordered, delivered',
    specTitle: 'Side-by-side specs',
    assumptionsTitle: 'Assumptions',
    costTitle: 'Cost comparison',
    decisionTitle: 'How to choose',
    footnotesTitle: 'Sources',
    seeAlso: 'See also',
    citedRangeNote:
      'The aluminum range is typical EU CNC job-shop pricing — not our quote. PA12-CF prices are computed by our quoting engine.',
    leadTimeLabel: 'Lead time',
    ourLeadValue: (days: number) => `${days} business days (express)`,
    aluLeadValue: (min: number, max: number) => `${min}–${max} business days`,
    maxTempLabel: 'Max service temperature',
    hdtValue: (c: number) => `${c} °C (HDT)`,
    aluMaxTempValue: (c: number) => `above ${c} °C`,
    conductivityLabel: 'Electrical conductivity',
    conductivityNo: 'no — insulator',
    conductivityYes: 'yes',
    aluminumHeader: '6061 aluminum (CNC)',
    componentHeader: 'Cost component',
    amountHeader: 'Amount',
    tcoMaterial: (g: number) => `Material — PLA, ${g} g`,
    tcoMachine: (h: number) => `Printer amortization — ${h} h of printing`,
    tcoOperator: (min: number) => `Operator time — ${min} min`,
    tcoFailure: (pct: number) => `Failed-print overhead — ${pct}%`,
    tcoTotalHobby: 'Total, when time is “free”',
    tcoTotalCosted: 'Total, with labor costed',
    tcoOrdered: 'Ordered from us — 1 pc, gross with shipping',
  },
  // Blog — UI chrome only; article prose lives in src/content/blog.
  blogPages: {
    breadcrumb: 'Knowledge base',
    indexTitle: 'FDM 3D printing knowledge base | MICRO_FACTORY',
    indexDescription:
      'Engineering guides to FDM printing: wall thickness, orientation, tolerances, fits. Concrete numbers instead of adjectives.',
    indexHeading: 'Knowledge base',
    indexIntro:
      'Practical guides to designing parts for FDM printing — written by engineers for engineers, based on what actually comes off our machines.',
    tagFilterLabel: 'Filter by tag',
    allTag: 'all',
    emptyFiltered: 'No articles with this tag.',
    publishedLabel: 'Published',
    updatedLabel: 'Updated',
    authorRole: 'MICRO_FACTORY engineering team',
    readingTime: (min: number) => `${min} min read`,
    readingTimeLabel: 'Reading time',
    tagsLabel: 'Tags',
    tocTitle: 'Contents',
    scrollHint: 'scroll →',
    shortVersionLabel: 'The short version',
    relatedTitle: 'Related articles',
    newestLabel: 'Newest',
    readGuide: 'Read the guide →',
    // Landing teaser (GuidesTeaser.tsx) — section label above the cards.
    teaserLabel: 'From the knowledge base',
    allGuidesTitle: 'All guides',
    guidesCount: (n: number) => `${n} ${enPlural(n, 'guide', 'guides')}`,
    rssNote: 'new guides via',
    rssLinkLabel: 'RSS ↗',
    writtenBy: 'Written by the MICRO_FACTORY engineering team',
    featureFigures: {
      'fdm-tolerances': {
        caption: 'Fig. 01 — Tolerance bands',
        annotation: '±0.3 MM / 100 MM',
      },
      'fdm-design-guide': {
        caption: 'Fig. 01 — Layer anisotropy',
        annotation: 'Z ≈ 50–80% XY',
      },
    } as Record<string, { caption: string; annotation: string }>,
    rssTitle: 'MICRO_FACTORY knowledge base (RSS)',
    rssDescription:
      'New engineering guides to FDM 3D printing from MICRO_FACTORY.',
  },
  // Shared quote CTA (QuoteCta.tsx) — every content page ends in it.
  cta: {
    headline: 'Have a part in hand?',
    trust: 'Quote in seconds · no account · VAT included',
    button: 'Upload a file',
  },
  dropzone: {
    idle: 'Drop a 3D file here',
    hint: 'or click to browse — STL, 3MF, OBJ, or STEP · up to 100 MB',
    button: 'Choose file',
    multiHint: 'Add up to 5 parts',
    dragActive: 'Release to upload',
    parsing: 'Reading geometry…',
    intake: 'Start your quote',
    intakeArmed: 'Drop to see your price',
    formats: 'STL · 3MF · OBJ · STEP — up to 100 MB',
    maxSize: 'Max 340 × 320 × 340 mm',
    mwLabel: 'or paste a MakerWorld link',
    mwPlaceholder: 'makerworld.com/en/models/…',
    mwButton: 'Fetch',
    mwFetching: 'Fetching from MakerWorld…',
  },
  quote: {
    parsingTitle: 'Measuring your part…',
    unitPrice: 'per part',
    recalculating: 'Recalculating…',
    orderButton: (price: string) => `Order for ${price}`,
    minOrderHint: (min: string) => `Minimum order ${min} — top-up applied`,
    exVat: 'Prices ex VAT',
    incVat: 'VAT included · 23% PL',
    priceBreaksTitle: 'Price per unit at quantity',
    breakdownTitle: 'Price breakdown',
    howWePrice: 'How we price',
    shippingNote: 'Ships D+1 to PL/DE, D+2 to the rest of the EU',
    notPrintable: 'Outside print limits',
    discountOff: (pct: string) => `${pct} off`,
    lineTotalFor: (total: string, qty: number) => `${total} for ${qty}`,
    metaTriangles: (count: number, formatted: string) =>
      `${formatted} ${enPlural(count, 'triangle', 'triangles')}`,
    metaPieces: (count: number) =>
      `${count} ${enPlural(count, 'part', 'parts')}`,
    metaPlates: (count: number) =>
      `${count} ${enPlural(count, 'plate', 'plates')}`,
  },
  quoteEmpty: {
    kicker: 'NEW_QUOTE',
    hint: 'Drop a 3D model — price and ship date in seconds.',
  },
  editor: {
    partsHeading: (count: number, max: number) => `Parts · ${count}/${max}`,
    outlinerEmpty: 'No parts — drop a file on the stage.',
    inspectorEmpty: 'Select a part to configure it.',
    inspectorLabel: 'Configuration & order',
    backHome: 'Main page',
    viewEditor: 'Editor',
    viewSimple: 'Simplified',
    viewFront: 'Front',
    viewTop: 'Top',
    viewRight: 'Right',
    viewIso: 'Iso',
    resetView: 'Frame part',
    grid: 'Grid',
    autoRotate: 'Auto-rotate',
    addPart: 'Add another part',
    addHint: (slots: number) =>
      `Joins this quote · ${slots} ${enPlural(slots, 'slot', 'slots')} left`,
    mwImport: 'MakerWorld import',
    compare: 'Compare',
    compareTitle: 'Materials bench',
    compareContext: (qty: number, lead: string) =>
      `unit price @ ×${qty} · ${lead}`,
    compareCurrent: 'Current',
    compareUnavailable: 'Out of range',
    compareLoading: 'Pricing…',
    compareFailed: 'Couldn’t load prices.',
    compareClose: 'Close compare',
    compareTaglines: {
      pla: 'Cheapest and easiest to print. Prototypes, concept models, display parts.',
      petg: 'Tough, moisture-resistant workhorse. Enclosures, brackets, functional parts.',
      pctg: 'Upgraded PETG with higher impact resistance. Housings and mechanical parts.',
      asa: 'UV- and weather-stable. Outdoor, automotive and exterior parts.',
      petg_fr:
        'Flame-retardant (UL94 V-0). Electronics enclosures and control cabinets.',
      pa12_cf:
        'Carbon-filled nylon — peak strength, heat resistance to ~170°C.',
      iglidur:
        'Self-lubricating Igus material. Bearings, bushings and sliding parts.',
    } satisfies Record<ProcessId, string>,
    checksPass: 'Checks pass',
    checksLabel: 'Checks',
    checksSummary: (n: number) => `${n} ${enPlural(n, 'notice', 'notices')}`,
    checksSummaryPass: 'Pass',
    footerCutoff: '14:00 same-day cutoff',
    nudge: (qty: number, pct: string) => `×${qty} unlocks −${pct} per part`,
    nudgeApply: (price: string) => `${price} / part →`,
    share: 'Share',
    shareCopyLink: 'Copy quote link',
    shareCopyLinkSub: 'Address of this page with the current quote',
    shareCsv: 'Download CSV',
    shareCsvSub: 'Line items for procurement systems',
    shareCopied: 'Copied ✓',
    shareSaved: 'Saved ✓',
    shareCsvHeader: 'file,material,qty,unit_price_pln,line_total_pln',
    shareCsvTotal: 'total',
    shareNote: 'Link opens this page — your quote stays in this browser.',
  },
  priceBreak: {
    qty: 'Qty',
    unitPrice: 'Unit price',
    discount: 'Discount',
  },
  viewer: {
    partPreview: (n: string) => `Part ${n} · Preview`,
    boundingBox: 'Bounding box',
    billableVolume: 'Billable volume',
    triangles: 'Triangles',
  },
  partsList: {
    reading: 'Reading…',
    manualQuote: 'Manual quote',
    failed: 'Failed',
    remove: (fileName: string) => `Remove ${fileName}`,
    uploadFailed: 'File save failed — quote still works',
    retryUpload: 'Retry save',
  },
  dfm: {
    labels: {
      exceeds_build_volume: 'Too large',
      small_feature: 'Thin feature',
      min_volume_billed: 'Min. volume',
      geometry_approximated: 'Geometry approximated',
      multi_plate: 'Multi-plate',
    } satisfies Record<DfmCode, string>,
    messages: {
      exceeds_build_volume: (p: Params) =>
        p.piece
          ? `A piece exceeds the ${num(p.x)}×${num(p.y)}×${num(p.z)} mm build plate.`
          : `Part exceeds the ${num(p.x)}×${num(p.y)}×${num(p.z)} mm build volume.`,
      small_feature: (p: Params) =>
        `Smallest dimension is ${num(p.minDimMm)} mm — thin features may not survive printing.`,
      min_volume_billed: (p: Params) =>
        `Under 1 cm³ — billed at the ${num(p.minCm3)} cm³ minimum.`,
      geometry_approximated: () =>
        'Mesh is not watertight — volume estimated from its convex hull. Final price may change.',
      multi_plate: (p: Params) =>
        `${num(p.pieces)} pieces pack onto ${num(p.plates)} build plates — ${num(p.extraFeePln)} zł per extra plate.`,
    } satisfies Record<DfmCode, (p: Params) => string>,
    unknown: 'Check the part details.',
    unknownLabel: 'Notice',
    suggestion: (processes: string) => ` Try: ${processes}.`,
  },
  breakdown: {
    material: 'Material',
    machine: 'Machine time',
    finishing: 'Finishing',
    plates: (n: number) => `Extra plates (${n})`,
  },
  apiError: {
    invalid_body: 'The request was malformed. Refresh and try again.',
    parts_count: (p: Params) =>
      `A quote can contain 1–${num(p.max ?? 5)} parts.`,
    unknown_process:
      'The selected material is no longer available. Refresh and re-quote.',
    unknown_lead_time:
      'The selected lead time is no longer available. Refresh and re-quote.',
    quantity_range: (p: Params) =>
      `Quantity must be between 1 and ${num(p.max ?? 100)}.`,
    invalid_metrics: 'The part geometry looks invalid. Re-upload the file.',
    invalid_email: 'That doesn’t look like an email address.',
    unsupported_country: 'We don’t ship to that country yet.',
    missing_file_fields:
      'The request was incomplete. Re-add the file and try again.',
    quote_file_invalid:
      'A file in this quote is no longer stored. Re-upload it and try again.',
    quote_not_found: 'Quote not found or expired.',
    missing_file_name: 'The file name is missing. Re-add the file.',
    invalid_file_size: 'The file size is invalid. Re-add the file.',
    invalid_design_id: 'That MakerWorld model link is invalid.',
    invalid_profile_id: 'That MakerWorld print profile is invalid.',
    invalid_hash: 'The file could not be verified. Re-add it.',
    unsupported_kind: 'Unsupported format. We accept STL, 3MF, OBJ, and STEP.',
    file_size_range: 'The file has an invalid size (max 100 MB).',
    file_not_found: 'The file was not found. Re-add it.',
    file_missing_hash: 'The file could not be verified. Re-add it.',
    upload_object_missing: 'The upload never reached storage. Try again.',
    upload_size_mismatch:
      'The uploaded file has a different size than declared. Try again.',
    storage_unavailable:
      'File storage is temporarily unavailable. Try again shortly.',
    code_invalid: 'Invalid code — check the email and try again.',
    code_expired: 'That code expired — send a new one.',
    too_many_attempts: 'Too many attempts — send a new code.',
    unauthorized: 'Sign in to continue.',
    order_not_found: 'Order not found.',
    order_wrong_state:
      'This order’s status has changed — refresh the page and try again.',
    quote_already_ordered: 'This quote has already been ordered.',
    invalid_nip: 'That NIP fails validation — check the digits.',
    transition_not_allowed: 'That status change is not allowed.',
    tracking_required: 'Enter the tracking number.',
    pricing_config_invalid: 'The pricing config is invalid.',
    erase_not_enabled: 'Data erasure is not available yet.',
    step_request_not_found: 'STEP request not found.',
    step_request_wrong_state: 'That STEP request’s status has changed.',
    internal: 'Something went wrong on our side. Try again.',
  } satisfies Record<ApiErrorCode, string | ((p: Params) => string)>,
  apiErrorGeneric: 'Something went wrong. Check your connection and try again.',
  orderPanel: {
    otherParts: (n: number) => `Other parts — ${n}`,
    minOrderTopUp: 'Minimum-order top-up',
    orderFee: 'Order fee',
    shipping: 'Shipping',
    free: 'Free',
    totalExVat: 'Total ex VAT',
    totalIncVat: 'Total incl. VAT',
    includesVat: (pct: number) => `Includes VAT (${pct}% PL)`,
    freeShippingApplied: 'Free shipping applied',
    breakdownFor: (name: string) => `Breakdown: ${name}`,
    excludedParts: (n: number) =>
      `Excluded from order: ${n} ${n === 1 ? 'part' : 'parts'} — outside print limits`,
  },
  howWePrice: {
    subtitle: 'No hidden math. Every quote is built from these numbers.',
    weightPara: (v: {
      shellMm: number
      infillPct: number
      cheapest: string
      priciest: string
      shellGh: number
      infillGh: number
    }) =>
      ` are priced by weight and machine time. We estimate print weight like a slicer would: a solid ${v.shellMm} mm shell over your part’s surface plus ${v.infillPct}% infill of the interior, converted to grams with the material’s density. We charge the material’s per-kg rate (${v.cheapest} up to ${v.priciest}), then add machine time — walls print at ${v.shellGh} g/h, infill at ${v.infillGh} g/h — × the machine’s hourly rate.`,
    weightLead: 'FDM materials',
    quantityLead: 'Quantity',
    quantityPara:
      ' earns a per-unit discount, from 5% at 5 units up to 28% at 50. ',
    leadTimeLead: 'Lead time',
    leadTimePara: (v: { economyPct: number; expressPct: number }) =>
      ` adjusts the price: Economy −${v.economyPct}%, Standard base, Express +${v.expressPct}%.`,
    feesPara: (v: {
      minPart: number
      minOrder: number
      orderFee: number
      shippingFlat: number
      freeThreshold: number
      vatPct: number
    }) =>
      `Every part is billed at least ${v.minPart} zł, and orders under ${v.minOrder} zł are topped up to the ${v.minOrder} zł minimum. Each order adds a flat ${v.orderFee} zł fee. Shipping is ${v.shippingFlat} zł flat, free above ${v.freeThreshold} zł. All prices include ${v.vatPct}% VAT (PL).`,
  },
  config: {
    process: 'Process & material',
    quantity: 'Quantity',
    leadTime: 'Lead time',
    economy: 'Economy',
    standard: 'Standard',
    express: 'Express',
    warsawCutoff: 'Times in Europe/Warsaw · 14:00 same-day cutoff',
    warsawTz: 'Europe/Warsaw',
    ships: (date: string) => `Ships ${date}`,
    base: 'base',
    printMeta: (grams: string, hours: string) =>
      `~${grams} g · ${hours} h print`,
  },
  step: {
    title: 'This STEP needs a quick manual check',
    body: 'We could not read this STEP file automatically. Leave your email and we will quote it by hand within 4 business hours.',
    emailLabel: 'Email',
    submit: 'Request quote',
    success: 'Got it — we will email your quote within 4 business hours.',
  },
  order: {
    title: 'Almost done',
    body: 'Tell us where to ship the parts. After placing the order we’ll redirect you to payment.',
    emailLabel: 'Email',
    countryLabel: 'Shipping country',
    shippingHeading: 'Shipping address',
    nameLabel: 'Full name',
    streetLabel: 'Street and number',
    cityLabel: 'City',
    postalCodeLabel: 'Postal code',
    b2bLabel: 'I’m buying for a company',
    companyLabel: 'Company name',
    nipLabel: 'NIP (Polish VAT ID)',
    invoiceLabel: 'I need a VAT invoice',
    billingToggle: 'Different billing address',
    billingHeading: 'Billing address',
    submit: (price: string) => `Order and pay · ${price}`,
    redirecting: 'Redirecting to payment…',
    orderTotal: 'Order total',
    failed: 'Could not place the order. Please try again.',
  },
  login: {
    kicker: 'Order_access',
    heading: 'Track your order.',
    sub: 'No account, so no password. Enter the email you ordered with and we send a one-time code — that’s the whole login.',
    factRetention: 'Quotes retained',
    factRetentionValue: '14 days',
    factValidity: 'Code validity',
    factValidityValue: '10 min',
    factClock: 'Europe/Warsaw',
    step1: 'Step 1 / 2',
    step1Heading: 'Where did we send your confirmation?',
    emailLabel: 'Email',
    emailPlaceholder: 'you@company.com',
    emailError: 'That doesn’t look like an email address.',
    sendCode: 'Send one-time code',
    emailNote: 'No email stored until you order',
    step2: 'Step 2 / 2',
    step2Heading: 'Enter the six-digit code',
    sentTo: 'Sent to',
    validity: '· valid 10 minutes',
    codeLabel: 'Code',
    codeError: 'Six digits — check the email and try again.',
    codeExpired: 'That code expired — send a new one and try again.',
    tooManyAttempts: 'Too many attempts — send a new code.',
    requestFailed: 'We couldn’t send the code. Try again.',
    openOrders: 'Open my orders',
    resend: 'Re-send code',
    resent: 'Code re-sent ✓',
    changeEmail: 'Change email',
  },
  orders: {
    signedIn: 'Signed in —',
    heading: 'Your orders',
    loading: 'Loading your orders…',
    loadFailed: 'Could not load orders. Check your connection and retry.',
    retry: 'Retry',
    empty: 'No orders for this email yet.',
    placed: 'Placed',
    moreParts: (n: number) => `+ ${n} more ${enPlural(n, 'part', 'parts')}`,
    newQuote: 'Start a new quote →',
    signOut: 'Sign out',
    payCta: 'Complete payment',
    status: {
      draft: 'Awaiting payment',
      paid: 'Paid',
      in_production: 'In production',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      refunded: 'Refunded',
    } satisfies Record<OrderStatus, string>,
  },
  pay: {
    kicker: 'Test_mode',
    title: 'Test payment',
    body: 'This is a payment placeholder — real payments (BLIK, card, P24) are coming soon. Click “Pay” to simulate a successful payment.',
    pay: 'Pay',
    cancel: 'Cancel',
    processing: 'Processing…',
    failed: 'The test payment could not be processed. Try again.',
  },
  orderStatus: {
    heading: 'Order status',
    processingTitle: 'Processing your payment…',
    processingBody:
      'Waiting for the payment provider’s confirmation. This usually takes a few seconds — the page refreshes itself.',
    paidTitle: 'Order paid',
    paidBody:
      'We’ve received your payment. The parts are heading to production — we’ll email the confirmation.',
    notFoundTitle: 'Order not found',
    notFoundBody:
      'This link is invalid or has expired. Check the address in your confirmation email.',
    items: 'Parts',
    placed: 'Placed',
    paidAt: 'Paid',
    quantity: (n: number) => `qty ${n}`,
    total: 'Total (gross)',
  },
  errors: {
    tooLarge: 'That file is over 100 MB. Please simplify or compress it first.',
    unsupported: 'Unsupported format. We accept STL, 3MF, OBJ, and STEP.',
    corrupt: 'We could not read that file — it may be corrupt or empty.',
    tooManyParts: 'Up to 5 parts per quote. Remove one to add another.',
    parseFailed: 'Something went wrong reading the geometry. Try re-uploading.',
    priceFailed: 'Could not fetch a price. Check your connection and retry.',
    webglMissing:
      'Your browser can’t show the 3D preview, but your quote is unaffected.',
    mwInvalidUrl: 'That doesn’t look like a MakerWorld model link.',
    mwNotFound: 'Model not found on MakerWorld — check the link.',
    mwNoProfile: 'This model has no downloadable print profile.',
    mwAuthExpired:
      'Our MakerWorld connection has expired. Try again later or upload the file directly.',
    mwNotConfigured: 'MakerWorld import is not configured on this server.',
    mwDownloadFailed:
      'Could not download the model from MakerWorld. Try again.',
    mwTooLarge: 'That model is over 100 MB. Download and simplify it first.',
  },
  emails: {
    footerBrand: 'EU · FDM · PLN · 23% VAT',
    footerSupport: 'Questions? Just reply to this email — a human reads it.',
    itemsLabel: 'Parts',
    orderLabel: 'Order',
    totalLabel: 'Total (gross)',
    qtySuffix: 'pcs',
    statusLinkLabel: 'Live order status:',
    loginCode: {
      subject: 'Your login code: {{.Code}}',
      heading: 'Your one-time code',
      body: 'Enter this code to see your orders:',
      validity: 'The code is valid for 10 minutes.',
      ignore: 'Didn’t ask for a code? Ignore this email.',
    },
    orderConfirmation: {
      subject: 'Order {{.OrderShortID}} confirmation',
      heading: 'Order received',
      body: 'Thank you! Your order is saved and awaiting payment — complete it and the parts go into production.',
    },
    paymentReceipt: {
      subject: 'Payment received for order {{.OrderShortID}}',
      heading: 'Payment received',
      body: 'Your payment is in — the order moves into production. Track progress on the status page.',
    },
    statusChange: {
      subject: 'Order {{.OrderShortID}} update',
      inProduction: {
        heading: 'Parts in production',
        body: 'Your order is on the machines. We’ll let you know when the parcel leaves.',
      },
      delivered: {
        heading: 'Order delivered',
        body: 'The parcel has arrived. If anything is off with the parts, reply to this email.',
      },
      cancelled: {
        heading: 'Order cancelled',
        body: 'Your order has been cancelled. If that’s a mistake, reply to this email and we’ll fix it.',
      },
      refunded: {
        heading: 'Refund booked',
        body: 'We returned the full amount to your original payment method. Depending on your bank this can take a few days.',
      },
    },
    shipped: {
      subject: 'Order {{.OrderShortID}} shipped',
      heading: 'Parcel on its way',
      body: 'Your parts have left. Tracking number:',
    },
    stepAck: {
      subject: 'We received {{.FileName}} for manual quoting',
      heading: 'File received',
      body: 'This STEP file needs a manual check — we’ll quote it within 4 working hours and reply to this address.',
    },
    stepNotify: {
      subject: 'STEP to quote manually: {{.FileName}}',
      heading: 'New STEP request',
      requestLabel: 'Request',
      emailLabel: 'Customer email',
      fileLabel: 'File',
      sizeLabel: 'Size',
    },
  },
  contactPage: {
    metaTitle: 'Contact | MICRO_FACTORY',
    metaDescription:
      'Question about an order, a quote, or a file? Write to us — we reply within one working day.',
    breadcrumb: 'Contact',
    kicker: 'Contact',
    heading: 'Write to us.',
    body: 'Question about an order, a quote, or a file? Write to us — a human replies, not a bot.',
    emailLabel: 'Email',
    responseTime: 'We reply within one working day (Mon–Fri, 9:00–17:00).',
    orderNote:
      'Writing about an order? Include its number — you’ll find it in the confirmation email.',
  },
} satisfies Dictionary
