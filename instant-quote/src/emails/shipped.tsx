import { Text } from '@react-email/components'
import { getStrings, type Locale } from '@/lib/i18n'
import { EmailLayout, styles } from './_layout'

export default function ShippedEmail({ locale = 'pl' }: { locale?: Locale }) {
  const t = getStrings(locale).emails
  return (
    <EmailLayout locale={locale}>
      <Text style={styles.heading}>{t.shipped.heading}</Text>
      <Text style={styles.body}>{t.shipped.body}</Text>
      <Text style={styles.code}>{'{{.TrackingNumber}}'}</Text>
      <Text style={styles.label}>{t.statusLinkLabel}</Text>
      <Text style={styles.link}>{'{{.StatusURL}}'}</Text>
    </EmailLayout>
  )
}
