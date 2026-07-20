import { Text } from '@react-email/components'
import { getStrings, type Locale } from '@/lib/i18n'
import { EmailLayout, styles } from './_layout'

export default function StepAckEmail({ locale = 'pl' }: { locale?: Locale }) {
  const t = getStrings(locale).emails.stepAck
  return (
    <EmailLayout locale={locale}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.body}>{t.body}</Text>
      <Text style={styles.muted}>{'{{.FileName}}'}</Text>
    </EmailLayout>
  )
}
