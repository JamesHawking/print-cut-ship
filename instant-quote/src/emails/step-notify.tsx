import { Text } from '@react-email/components'
import { getStrings, type Locale } from '@/lib/i18n'
import { EmailLayout, styles } from './_layout'

// Internal operator notification (plan 06) — PL only by design; the
// build-emails registry renders just the pl artifacts for this template.
export default function StepNotifyEmail({
  locale = 'pl',
}: {
  locale?: Locale
}) {
  const t = getStrings(locale).emails.stepNotify
  return (
    <EmailLayout locale={locale}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.body}>{`${t.requestLabel}: {{.RequestID}}`}</Text>
      <Text style={styles.body}>{`${t.emailLabel}: {{.Email}}`}</Text>
      <Text style={styles.body}>{`${t.fileLabel}: {{.FileName}}`}</Text>
      <Text style={styles.body}>{`${t.sizeLabel}: {{.FileSize}}`}</Text>
    </EmailLayout>
  )
}
