// All user-facing English copy lives here (no i18n framework; single source).

export const strings = {
  meta: {
    title: 'Instant 3D printing quote — upload, price, order',
    description:
      'Upload an STL, 3MF, OBJ or STEP file and get an instant price. Made in the EU, ships D+1/D+2 to Germany. No account needed.',
  },
  hero: {
    headline: 'Upload a part, get a price. Right now.',
    trust: 'Made in the EU. Ships D+1/D+2 to Germany. No account needed.',
  },
  dropzone: {
    idle: 'Drop a 3D file here',
    hint: 'or click to browse — STL, 3MF, OBJ, or STEP · up to 100 MB',
    button: 'Choose file',
    multiHint: 'Add up to 5 parts',
    dragActive: 'Release to upload',
    parsing: 'Reading geometry…',
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
    title: 'STEP needs a quick manual check',
    body: 'We quote STEP files by hand to get the geometry right. Leave your email and we will send a price within 4 business hours.',
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
    webglMissing:
      'Your browser can’t show the 3D preview, but your quote is unaffected.',
  },
} as const
