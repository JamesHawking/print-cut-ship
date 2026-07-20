#!/usr/bin/env bun
// Pre-renders the React Email templates in src/emails/ × locale into Go
// template artifacts under backend/internal/email/templates/ (plan 06):
// <name>.<locale>.html (html/template) + <name>.<locale>.subject.txt
// (text/template). The Go service embeds these and interpolates the {{…}}
// placeholders at send time. Drift gate: re-run after any copy/template
// change — `git status` must stay clean (same convention as codegen).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { render } from '@react-email/render'
import { getStrings, LOCALES, type Locale } from '@/lib/i18n'
import LoginCodeEmail from '../src/emails/login-code'
import OrderConfirmationEmail from '../src/emails/order-confirmation'
import PaymentReceiptEmail from '../src/emails/payment-receipt'
import StatusChangeEmail from '../src/emails/status-change'
import ShippedEmail from '../src/emails/shipped'
import StepAckEmail from '../src/emails/step-ack'
import StepNotifyEmail from '../src/emails/step-notify'

const OUT_DIR = join(import.meta.dir, '../../backend/internal/email/templates')

interface EmailTemplate {
  name: string
  component: (props: { locale?: Locale }) => React.JSX.Element
  subject: (locale: Locale) => string
  locales: readonly Locale[]
}

const TEMPLATES: EmailTemplate[] = [
  {
    name: 'login_code',
    component: LoginCodeEmail,
    subject: (l) => getStrings(l).emails.loginCode.subject,
    locales: LOCALES,
  },
  {
    name: 'order_confirmation',
    component: OrderConfirmationEmail,
    subject: (l) => getStrings(l).emails.orderConfirmation.subject,
    locales: LOCALES,
  },
  {
    name: 'payment_receipt',
    component: PaymentReceiptEmail,
    subject: (l) => getStrings(l).emails.paymentReceipt.subject,
    locales: LOCALES,
  },
  {
    name: 'status_change',
    component: StatusChangeEmail,
    subject: (l) => getStrings(l).emails.statusChange.subject,
    locales: LOCALES,
  },
  {
    name: 'shipped',
    component: ShippedEmail,
    subject: (l) => getStrings(l).emails.shipped.subject,
    locales: LOCALES,
  },
  {
    name: 'step_ack',
    component: StepAckEmail,
    subject: (l) => getStrings(l).emails.stepAck.subject,
    locales: LOCALES,
  },
  {
    // Operator-facing — PL only by design.
    name: 'step_notify',
    component: StepNotifyEmail,
    subject: (l) => getStrings(l).emails.stepNotify.subject,
    locales: ['pl'],
  },
]

mkdirSync(OUT_DIR, { recursive: true })
let count = 0
for (const t of TEMPLATES) {
  for (const locale of t.locales) {
    const html = await render(createElement(t.component, { locale }))
    writeFileSync(join(OUT_DIR, `${t.name}.${locale}.html`), html)
    writeFileSync(
      join(OUT_DIR, `${t.name}.${locale}.subject.txt`),
      t.subject(locale) + '\n',
    )
    count += 2
  }
}
console.log(`build-emails: wrote ${count} artifacts to ${OUT_DIR}`)
