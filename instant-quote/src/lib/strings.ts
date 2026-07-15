// All user-facing English copy lives here (no i18n framework; single source).

export const strings = {
  meta: {
    title: 'Instant 3D printing quote — upload, price, order',
    description:
      'Upload an STL, 3MF, OBJ or STEP file and get an instant price. Made in the EU, ships D+1/D+2 to Germany. No account needed.',
  },
  hero: {
    wordmark: 'INSTANT_QUOTE',
    status: 'EU · FDM · PLN',
    ready: 'System ready',
    kicker: 'On-demand 3D printing · EU',
    headline: 'Upload a part, get a price. Right now.',
    sub: 'The fastest, most transparent way to price a 3D-printed part in the EU — a full cost breakdown and a real ship date, with no account and no waiting.',
    trust: 'Made in the EU · Ships D+1/D+2 to Germany · No account',
    privacy: 'Private — files never leave your session unless you order',
    figCaption: 'Automated line — print · pick · pack · ship',
    figNo: 'Fig. 01',
    // Zipped with computed values in Hero.tsx (same order).
    specs: [
      'FDM materials',
      'mm build volume',
      'business-day lead',
      'VAT included · PLN',
    ],
  },
  nav: {
    howItWorks: 'How it works',
    materials: 'Materials',
    resume: (n: number) => `Resume quote (${n}) →`,
    newQuote: '← New quote',
  },
  process: {
    kicker: 'How it works',
    heading: 'From file to ship date in three steps.',
    steps: [
      {
        n: '01',
        title: 'Upload',
        body: 'Drop an STL, 3MF, OBJ or STEP. The geometry is measured right in your browser — nothing is uploaded just to price it.',
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
    kicker: 'Materials',
    heading: 'Seven FDM materials, prototype to end-use.',
    sub: 'From cheap PLA to carbon-filled nylon and self-lubricating Igus grades — pick what the part needs.',
    material: 'Material',
    application: 'Application',
    density: 'Density',
    from: 'From',
    footnote:
      'Rates are gross, incl. 23% PL VAT · final price is computed from your geometry',
  },
  materials: {
    pla: {
      family: 'Standard',
      tagline:
        'Cheapest and easiest to print. Prototypes, concept models, display parts.',
    },
    petg: {
      family: 'Standard',
      tagline:
        'Tough, moisture-resistant workhorse. Enclosures, brackets, functional parts.',
    },
    pctg: {
      family: 'Standard',
      tagline:
        'Upgraded PETG with higher impact resistance. Housings and mechanical parts.',
    },
    asa: {
      family: 'Engineering',
      tagline:
        'UV- and weather-stable. Outdoor, automotive and exterior parts.',
    },
    petg_fr: {
      family: 'Specialty',
      tagline:
        'Flame-retardant (UL94 V-0). Electronics enclosures and control cabinets.',
    },
    pa12_cf: {
      family: 'Engineering',
      tagline:
        'Carbon-filled nylon — peak strength, heat resistance to ~170°C. Jigs, gears, motorsport.',
    },
    iglidur: {
      family: 'Specialty',
      tagline:
        'Self-lubricating Igus material. Bearings, bushings and sliding parts.',
    },
  },
  footer: {
    ctaHeading: 'Have a part in hand?',
    ctaBody: 'Get a transparent price in seconds — no account required.',
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
} as const
