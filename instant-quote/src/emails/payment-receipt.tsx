import { Text } from '@react-email/components'
import { getStrings, type Locale } from '@/lib/i18n'
import { EmailLayout, OrderLines, styles } from './_layout'

export default function PaymentReceiptEmail({
  locale = 'pl',
}: {
  locale?: Locale
}) {
  const t = getStrings(locale).emails.paymentReceipt
  return (
    <EmailLayout locale={locale}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.body}>{t.body}</Text>
      <OrderLines locale={locale} />
    </EmailLayout>
  )
}
