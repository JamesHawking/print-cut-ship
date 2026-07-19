import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { OrderAccessShell } from '@/components/OrderAccessShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api/client'
import { useSession } from '@/lib/useSession'
import {
  DEFAULT_LOCALE,
  getStrings,
  isLocale,
  useLocale,
  useStrings,
} from '@/lib/i18n'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/login')({
  head: ({ params, match }) => {
    const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const s = getStrings(locale)
    return seoHead({
      locale,
      path: match.pathname,
      title: s.meta.login.title,
      description: s.meta.login.description,
      noindex: true,
    })
  },
  component: Login,
})

const EMAIL_RE = /.+@.+\..+/

function Login() {
  const s = useStrings().login
  const locale = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const [codeErrorMsg, setCodeErrorMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resent, setResent] = useState(false)
  const resentTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Already signed in — straight to the orders page.
  useEffect(() => {
    if (session.data)
      void navigate({
        to: '/$locale/orders',
        params: { locale },
        replace: true,
      })
  }, [session.data, navigate, locale])

  useEffect(() => () => clearTimeout(resentTimer.current), [])

  async function requestCode(): Promise<boolean> {
    const res = await api.POST('/api/v1/auth/request-code', {
      body: { email },
    })
    return res.response.ok
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setEmailError(true)
      return
    }
    setEmailError(false)
    setSendFailed(false)
    setPending(true)
    const ok = await requestCode().catch(() => false)
    setPending(false)
    if (!ok) {
      setSendFailed(true)
      return
    }
    setCode('')
    setCodeErrorMsg(null)
    setStep('code')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setCodeErrorMsg(s.codeError)
      return
    }
    setCodeErrorMsg(null)
    setPending(true)
    const res = await api
      .POST('/api/v1/auth/verify-code', { body: { email, code } })
      .catch(() => undefined)
    setPending(false)
    if (res?.response.ok) {
      // Seed the session cache so /orders doesn't bounce through a 401.
      queryClient.setQueryData(['auth', 'me'], { email })
      void navigate({ to: '/$locale/orders', params: { locale } })
      return
    }
    if (res?.response.status === 401 && res.error) {
      switch (res.error.code) {
        case 'code_expired':
          setCodeErrorMsg(s.codeExpired)
          return
        case 'too_many_attempts':
          setCodeErrorMsg(s.tooManyAttempts)
          return
        default:
          setCodeErrorMsg(s.codeError)
          return
      }
    }
    setCodeErrorMsg(s.requestFailed)
  }

  async function resend() {
    setResent(true)
    clearTimeout(resentTimer.current)
    resentTimer.current = setTimeout(() => setResent(false), 1600)
    await requestCode().catch(() => undefined)
  }

  return (
    <OrderAccessShell>
      {step === 'email' ? (
        <form className="flex flex-col gap-6" onSubmit={sendCode}>
          <div>
            <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
              {s.step1}
            </p>
            <h2 className="mt-2.5 text-xl font-extrabold tracking-tight">
              {s.step1Heading}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-email"
              className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase"
            >
              {s.emailLabel}
            </label>
            <Input
              id="login-email"
              type="email"
              autoFocus
              placeholder={s.emailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError(false)
                setSendFailed(false)
              }}
            />
            {emailError && (
              <span className="text-destructive text-xs">{s.emailError}</span>
            )}
            {sendFailed && (
              <span className="text-destructive text-xs">
                {s.requestFailed}
              </span>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="font-bold"
            disabled={pending}
          >
            {s.sendCode}
          </Button>
          <p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.14em] uppercase">
            {s.emailNote}
          </p>
        </form>
      ) : (
        <form className="flex flex-col gap-6" onSubmit={verifyCode}>
          <div>
            <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
              {s.step2}
            </p>
            <h2 className="mt-2.5 text-xl font-extrabold tracking-tight">
              {s.step2Heading}
            </h2>
            <p className="text-muted-foreground mt-2 text-[13.5px]">
              {s.sentTo} <strong className="text-foreground">{email}</strong>{' '}
              {s.validity}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-code"
              className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase"
            >
              {s.codeLabel}
            </label>
            <Input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                setCodeErrorMsg(null)
              }}
              className="h-14 text-center font-mono !text-2xl font-bold tracking-[0.5em] tabular-nums"
            />
            {codeErrorMsg && (
              <span className="text-destructive text-xs">{codeErrorMsg}</span>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            className="font-bold"
            disabled={pending}
          >
            {s.openOrders}
          </Button>
          <div className="flex gap-5">
            <button
              type="button"
              onClick={resend}
              className="text-muted-foreground hover:text-foreground cursor-pointer font-mono text-[0.65rem] tracking-[0.14em] uppercase underline underline-offset-4 transition-colors"
            >
              {resent ? s.resent : s.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setCodeErrorMsg(null)
              }}
              className="text-muted-foreground hover:text-foreground cursor-pointer font-mono text-[0.65rem] tracking-[0.14em] uppercase underline underline-offset-4 transition-colors"
            >
              {s.changeEmail}
            </button>
          </div>
        </form>
      )}
    </OrderAccessShell>
  )
}
