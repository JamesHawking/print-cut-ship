import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { OrderAccessShell } from '@/components/OrderAccessShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSessionEmail, setSessionEmail } from '@/lib/session'
import { strings } from '@/lib/strings'

export const Route = createFileRoute('/login')({ component: Login })

const EMAIL_RE = /.+@.+\..+/

function Login() {
  const s = strings.login
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const [resent, setResent] = useState(false)
  const resentTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Already signed in — straight to the orders page.
  useEffect(() => {
    if (getSessionEmail()) void navigate({ to: '/orders', replace: true })
  }, [navigate])

  useEffect(() => () => clearTimeout(resentTimer.current), [])

  function sendCode(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setEmailError(true)
      return
    }
    setEmailError(false)
    setCode('')
    setCodeError(false)
    setStep('code')
  }

  // The code is simulated (see the shell's footer note): any six digits pass.
  function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setCodeError(true)
      return
    }
    setSessionEmail(email)
    void navigate({ to: '/orders' })
  }

  function resend() {
    setResent(true)
    clearTimeout(resentTimer.current)
    resentTimer.current = setTimeout(() => setResent(false), 1600)
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
              }}
            />
            {emailError && (
              <span className="text-destructive text-xs">{s.emailError}</span>
            )}
          </div>
          <Button type="submit" size="lg" className="font-bold">
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
                setCodeError(false)
              }}
              className="h-14 text-center font-mono !text-2xl font-bold tracking-[0.5em] tabular-nums"
            />
            {codeError && (
              <span className="text-destructive text-xs">{s.codeError}</span>
            )}
          </div>
          <Button type="submit" size="lg" className="font-bold">
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
                setCodeError(false)
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
