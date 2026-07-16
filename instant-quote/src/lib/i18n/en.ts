// English dictionary — must satisfy the Dictionary type inferred from pl.ts.
// Adding a key to one locale without the other is a compile error.

import type { Dictionary } from './types'
import type { MaterialFamily } from './pl'
import { enPlural } from './plural'

type OrderStatus = 'submitted' | 'expired' | 'ordered'

export const en = {
  meta: {
    title: 'Instant 3D printing quote — upload, price, order',
    description:
      'Upload an STL, 3MF, OBJ or STEP file and get an instant price. Made in the EU, ships D+1/D+2 to Germany. No account needed.',
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
    ctaHeading: 'Have a part in hand?',
    ctaButton: 'Upload a file',
    note: 'Prototype · illustrative rates · every quote is fully itemized',
    meta: 'EU · FDM · PLN · 23% VAT',
    cutoff: '14:00 cutoff',
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
    lineTotal: 'line total',
    orderButton: (price: string) => `Order for ${price}`,
    minOrderHint: (min: string) => `Minimum order ${min} — top-up applied`,
    exVat: 'Prices ex VAT',
    incVat: 'Prices incl. VAT (23% PL)',
    priceBreaksTitle: 'Price per unit at quantity',
    breakdownTitle: 'Price breakdown',
    howWePrice: 'How we price',
    shippingNote: 'Ships D+1 to PL/DE, D+2 to the rest of the EU',
  },
  config: {
    process: 'Process & material',
    quantity: 'Quantity',
    leadTime: 'Lead time',
    economy: 'Economy',
    standard: 'Standard',
    express: 'Express',
    warsawCutoff: 'Times in Europe/Warsaw · 14:00 same-day cutoff',
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
