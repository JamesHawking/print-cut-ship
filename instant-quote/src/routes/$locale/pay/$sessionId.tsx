import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'

import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  useLocale,
  useStrings,
} from '@/lib/i18n'
import { seoHead } from '@/lib/seo'
import { Button } from '@/components/ui/button'

// The stub provider's fake checkout (PAYMENTS_PROVIDER=stub) — the stand-in
// for Stripe's hosted page until plan 18. Pay feeds a synthetic
// checkout.session.completed into the real event pipeline; the browser then
// follows the success URL, exactly like a PSP redirect.
export const Route = createFileRoute('/$locale/pay/$sessionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    success: typeof search.success === 'string' ? search.success : '',
    cancel: typeof search.cancel === 'string' ? search.cancel : '',
  }),
  head: ({ params, match }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    return seoHead({
      locale,
      path: match.pathname,
      title: s.meta.pay.title,
      description: s.meta.pay.description,
      noindex: true,
    })
  },
  component: PayStub,
})

function PayStub() {
  const { sessionId } = Route.useParams()
  const { success, cancel } = Route.useSearch()
  const strings = useStrings()
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function pay() {
    setBusy(true)
    setFailed(false)
    try {
      const res = await fetch('/api/v1/payments/stub/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sessionId }),
      })
      if (!res.ok) throw new Error(`stub complete ${res.status}`)
      window.location.assign(success || `/${locale}/orders`)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 font-mono text-xs tracking-widest uppercase sm:px-6">
          <Link to="/$locale" params={{ locale }} className="font-bold">
            {strings.hero.wordmark}
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="bg-card w-full max-w-md space-y-5 rounded-lg border p-8 shadow-xl shadow-black/[0.06]">
          <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            {strings.pay.kicker}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {strings.pay.title}
          </h1>
          <p className="text-muted-foreground text-sm">{strings.pay.body}</p>
          {failed && (
            <p className="text-destructive text-sm">{strings.pay.failed}</p>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => void pay()}
              disabled={busy}
              className="flex-1 font-bold"
            >
              {busy ? strings.pay.processing : strings.pay.pay}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                window.location.assign(cancel || `/${locale}/quote`)
              }
            >
              {strings.pay.cancel}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
