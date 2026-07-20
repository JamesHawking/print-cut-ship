import { Text } from '@react-email/components'
import { getStrings, type Locale } from '@/lib/i18n'
import { EmailLayout, styles } from './_layout'

// One template, four status variants selected by Go {{if eq .NewStatus …}}
// blocks (backquoted literals — React would HTML-escape double quotes in
// text nodes and corrupt the action). Triggering statuses: in_production,
// delivered, cancelled (admin board) and refunded (payments pipeline).
export default function StatusChangeEmail({
  locale = 'pl',
}: {
  locale?: Locale
}) {
  const t = getStrings(locale).emails
  return (
    <EmailLayout locale={locale}>
      {'{{if eq .NewStatus `in_production`}}'}
      <Text style={styles.heading}>{t.statusChange.inProduction.heading}</Text>
      <Text style={styles.body}>{t.statusChange.inProduction.body}</Text>
      {'{{end}}'}
      {'{{if eq .NewStatus `delivered`}}'}
      <Text style={styles.heading}>{t.statusChange.delivered.heading}</Text>
      <Text style={styles.body}>{t.statusChange.delivered.body}</Text>
      {'{{end}}'}
      {'{{if eq .NewStatus `cancelled`}}'}
      <Text style={styles.heading}>{t.statusChange.cancelled.heading}</Text>
      <Text style={styles.body}>{t.statusChange.cancelled.body}</Text>
      {'{{end}}'}
      {'{{if eq .NewStatus `refunded`}}'}
      <Text style={styles.heading}>{t.statusChange.refunded.heading}</Text>
      <Text style={styles.body}>{t.statusChange.refunded.body}</Text>
      {'{{end}}'}
      <Text style={styles.label}>{t.statusLinkLabel}</Text>
      <Text style={styles.link}>{'{{.StatusURL}}'}</Text>
    </EmailLayout>
  )
}
