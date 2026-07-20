// Shared shell for every transactional email (plan 06): wordmark header,
// PLN/VAT + support footer. Styled with inline styles only (email clients).
// Go placeholders appear as literal text nodes — never in attributes — so
// React's escaping can't corrupt them (build-emails.ts pre-renders this to
// Go html/template artifacts).
import {
  Body,
  Container,
  Head,
  Html,
  Section,
  Text,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import { getStrings, type Locale } from '@/lib/i18n'

export const styles: Record<string, CSSProperties> = {
  heading: {
    color: '#18181b',
    fontSize: '22px',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    margin: '0 0 12px',
  },
  body: {
    color: '#3f3f46',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 16px',
  },
  muted: {
    color: '#71717a',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '16px 0 0',
  },
  label: {
    color: '#71717a',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.18em',
    margin: '24px 0 8px',
    textTransform: 'uppercase',
  },
  code: {
    color: '#18181b',
    fontFamily: 'monospace',
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '0.4em',
    margin: '8px 0 16px',
  },
  row: { margin: '0 0 4px' },
  rowText: {
    color: '#3f3f46',
    fontSize: '13px',
    lineHeight: '20px',
    margin: 0,
  },
  total: {
    borderTop: '1px solid #e4e4e7',
    color: '#18181b',
    fontSize: '14px',
    fontWeight: 700,
    margin: '8px 0 0',
    paddingTop: '8px',
  },
  link: {
    color: '#18181b',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '4px 0 0',
    wordBreak: 'break-all',
  },
}

export function EmailLayout({
  locale,
  children,
}: {
  locale: Locale
  children?: ReactNode
}) {
  const strings = getStrings(locale)
  return (
    <Html lang={locale}>
      <Head />
      <Body
        style={{
          backgroundColor: '#f4f4f5',
          fontFamily: 'Helvetica, Arial, sans-serif',
          margin: 0,
          padding: '24px 0',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e4e4e7',
            maxWidth: '560px',
            padding: '32px',
          }}
        >
          <Text
            style={{
              color: '#18181b',
              fontFamily: 'monospace',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              margin: '0 0 24px',
            }}
          >
            {strings.hero.wordmark}
          </Text>
          {children}
          <Section
            style={{
              borderTop: '1px solid #e4e4e7',
              marginTop: '32px',
              paddingTop: '16px',
            }}
          >
            <Text
              style={{
                color: '#71717a',
                fontSize: '10px',
                letterSpacing: '0.12em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {strings.emails.footerBrand}
            </Text>
            <Text
              style={{
                color: '#71717a',
                fontSize: '12px',
                lineHeight: '18px',
                margin: '8px 0 0',
              }}
            >
              {strings.emails.footerSupport}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/** Order lines block shared by order_confirmation / payment_receipt. The
    item loop is a literal Go {{range}} block — iteration happens server-side
    on the pre-rendered artifact. */
export function OrderLines({ locale }: { locale: Locale }) {
  const t = getStrings(locale).emails
  return (
    <>
      <Text style={styles.label}>{t.orderLabel}</Text>
      <Text style={styles.body}>{'{{.OrderShortID}}'}</Text>
      <Text style={styles.label}>{t.itemsLabel}</Text>
      {'{{range .Items}}'}
      <Section style={styles.row}>
        <Text
          style={styles.rowText}
        >{`{{.Quantity}} ${t.qtySuffix} × {{.FileName}} — {{.LineTotal}}`}</Text>
      </Section>
      {'{{end}}'}
      <Text style={styles.total}>{`${t.totalLabel}: {{.GrossTotal}}`}</Text>
      <Text style={styles.label}>{t.statusLinkLabel}</Text>
      <Text style={styles.link}>{'{{.StatusURL}}'}</Text>
    </>
  )
}
