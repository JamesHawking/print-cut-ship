import { useState } from 'react'
import { FileClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useStrings } from '@/lib/i18n'
import { api } from '@/lib/api/client'
import { track } from '@/lib/funnel'
import type { Part } from '@/hooks/useParts'

export function StepManualCard({ part }: { part: Part }) {
  const strings = useStrings()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!email) return
    setSubmitting(true)
    try {
      const res = await api.POST('/api/v1/step-quotes', {
        body: { email, fileName: part.fileName, fileSize: part.fileSize },
      })
      if (!res.data) throw new Error('request failed')
      track('step_quote_requested', { requestId: res.data.requestId })
      setDone(true)
      toast.success(strings.step.success)
    } catch {
      toast.error(strings.errors.parseFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileClock className="text-primary size-5" />
          {strings.step.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{strings.step.body}</p>
        {done ? (
          <p className="text-sm font-medium">{strings.step.success}</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div className="space-y-2">
              <Label
                htmlFor={`step-email-${part.id}`}
                className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.2em] uppercase"
              >
                {strings.step.emailLabel}
              </Label>
              <Input
                id={`step-email-${part.id}`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={strings.login.emailPlaceholder}
              />
            </div>
            <Button type="submit" disabled={submitting || !email}>
              {strings.step.submit}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
