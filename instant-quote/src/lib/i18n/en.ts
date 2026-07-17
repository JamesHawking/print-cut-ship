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

type Params = Record<string, unknown>

const num = (v: unknown): string => {
  if (typeof v === 'number') return formatDecimal(v, 'en', 2)
  return typeof v === 'string' ? v : '—'
}

export const en = {
  meta: {
    title: 'Instant 3D printing quote — upload, price, order',
    description:
      'Upload an STL, 3MF, OBJ or STEP file and get an instant price. Made in the EU, ships D+1/D+2 to Germany. No account needed.',
    quote: {
      title: 'Your quote — MICRO_FACTORY',
      description:
        'Pick material, quantity and lead time — the price updates live.',
    },
    login: {
      title: 'Track your order — MICRO_FACTORY',
      description:
        'Access your orders with a one-time code — no account, no password.',
    },
    orders: {
      title: 'Your orders — MICRO_FACTORY',
      description: 'Quote and order history linked to your email address.',
    },
  },
  hero: {
    wordmark: 'MICRO_FACTORY',
    status: 'EU · FDM · PLN',
    ready: 'Ready',
    kickerBadge: 'EU',
    kicker: 'On-demand 3D printing · Poland · PLN',
    headline1: 'Upload a part.',
    headline2: 'Get a price.',
    sub: 'Not a request form. Not a sales call. Drop the file and the machine answers — a full cost breakdown and a real ship date, in seconds, with no account.',
    sample: 'No file handy? Try a sample part →',
    privacy:
      'Private — files are used only to prepare your quote and auto-deleted if you don’t order',
    figCaption: 'Automated line — print · pick · pack · ship',
    figAlt:
      'Automated production line: a part is 3D-printed, moved by a robot arm, then packed for shipping.',
    figNo: 'Fig. 01',
    // Zipped with computed values in Hero.tsx (same order).
    specs: [
      'FDM materials',
      'business-day lead',
      'shipping PL/DE · D+2 EU',
      'VAT always included',
    ],
  },
  nav: {
    howItWorks: 'How it works',
    materials: 'Materials',
    pricing: 'Pricing',
    trackOrder: 'Track order',
    menuLabel: 'Toggle menu',
    resume: (n: number) => `Resume quote (${n}) →`,
    newQuote: '← New quote',
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
    steps: [
      {
        n: '01',
        title: 'Upload',
        body: 'Drop an STL, 3MF, OBJ or STEP. The geometry is measured right in your browser, and your file is stored securely so we can print it — auto-deleted if you don’t order.',
      },
      {
        n: '02',
        title: 'Price',
        body: 'A transparent, itemized quote appears in seconds. Material, machine time, quantity, lead time — every number is explainable.',
      },
      {
        n: '03',
        title: 'Order',
        body: 'Pick material and quantity, see a real ship date, and place the order. No account, no sales call, no waiting.',
      },
    ],
  },
  materialsSection: {
    n: '02',
    heading: 'Seven materials, prototype to end-use',
    material: 'Material',
    application: 'Application',
    density: 'Density',
    from: 'From',
    footnote: 'Rates gross incl. 23% VAT',
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
        body: 'A 0,9 mm shell over your part’s surface plus 20% infill, converted to grams by material density.',
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
  footer: {
    note: 'Prototype · illustrative rates · every quote is fully itemized',
    meta: 'EU · FDM · PLN · 23% VAT',
    cutoff: '14:00 cutoff',
  },
  // Material landing pages — UI chrome only; long-form prose lives in
  // src/content/materials/{pl,en}.ts.
  materialsPages: {
    breadcrumbHome: 'Home',
    breadcrumbMaterials: 'Materials',
    indexTitle: '3D printing materials — prices & properties | MICRO_FACTORY',
    indexDescription:
      'Seven FDM materials from prototype to end-use: properties, design limits, and prices computed by the quoting engine.',
    indexHeading: '3D printing materials',
    indexIntro:
      'Every material prints on the same machines and is priced by the same engine as the quote form. Pick a material for properties, design guidance, and reference prices.',
    priceFrom: (price: string) => `from ${price}`,
    comingSoon: 'Page coming soon',
    propertiesTitle: 'Properties',
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
    shipsLabel: (lead: string, weekday: string) => `${lead} → ships ${weekday}`,
    minimumsTitle: 'Minimums & shipping',
    minOrderExampleTitle: 'When the minimum binds',
    fullRateCardLink: 'Full rate card →',
    noHiddenTitle: 'No hidden costs',
    comparisonTitle: 'An honest comparison',
    faqTitle: 'Pricing FAQ',
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
    intake: 'File intake',
    intakeArmed: 'File intake — armed',
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
    orderButton: (price: string) => `Order for ${price}`,
    minOrderHint: (min: string) => `Minimum order ${min} — top-up applied`,
    exVat: 'Prices ex VAT',
    incVat: 'Prices incl. VAT (23% PL)',
    priceBreaksTitle: 'Price per unit at quantity',
    breakdownTitle: 'Price breakdown',
    howWePrice: 'How we price',
    shippingNote: 'Ships D+1 to PL/DE, D+2 to the rest of the EU',
    notPrintable: 'Not printable',
    discountOff: (pct: string) => `${pct} off`,
    lineTotalFor: (total: string, qty: number) => `${total} for ${qty}`,
    metaTriangles: (count: number, formatted: string) =>
      `${formatted} ${enPlural(count, 'triangle', 'triangles')}`,
    metaPieces: (count: number) =>
      `${count} ${enPlural(count, 'part', 'parts')}`,
    metaPlates: (count: number) =>
      `${count} ${enPlural(count, 'plate', 'plates')}`,
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
    body: 'Tell us where to send it. No account, no payment now — this reserves your quote.',
    emailLabel: 'Email',
    countryLabel: 'Shipping country',
    submit: (price: string) => `Place order · ${price}`,
    successTitle: 'Order received',
    successBody: 'We emailed a confirmation. Your quote reference is',
    orderTotal: 'Order total',
    done: 'Done',
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
    openOrders: 'Open my orders',
    resend: 'Re-send code',
    resent: 'Code re-sent ✓',
    changeEmail: 'Change email',
    simNote: 'Prototype · one-time codes are simulated · nothing is sent',
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
    status: {
      submitted: 'Received',
      ordered: 'In production',
      expired: 'Expired',
    } satisfies Record<OrderStatus, string>,
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
      'MakerWorld access expired — refresh BAMBU_CLOUD_TOKEN on the server.',
    mwNotConfigured: 'MakerWorld import is not configured on this server.',
    mwDownloadFailed:
      'Could not download the model from MakerWorld. Try again.',
    mwTooLarge: 'That model is over 100 MB. Download and simplify it first.',
  },
} satisfies Dictionary
