import { Text } from '@react-email/components'
import { getStrings, type Locale } from '@/lib/i18n'
import { EmailLayout, styles } from './_layout'

export default function LoginCodeEmail({ locale = 'pl' }: { locale?: Locale }) {
  const t = getStrings(locale).emails.loginCode
  return (
    <EmailLayout locale={locale}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.body}>{t.body}</Text>
      <Text style={styles.code}>{'{{.Code}}'}</Text>
      <Text style={styles.body}>{t.validity}</Text>
      <Text style={styles.muted}>{t.ignore}</Text>
    </EmailLayout>
  )
}
