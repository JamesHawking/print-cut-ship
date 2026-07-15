import { strings } from '@/lib/strings'

export function HowItWorks() {
  const { kicker, heading, steps } = strings.process
  return (
    <section id="how-it-works" className="scroll-mt-14 border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
          {kicker}
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-balance sm:text-4xl">
          {heading}
        </h2>
        <ol className="bg-border mt-12 grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="bg-card p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="text-primary-text font-mono text-sm font-bold tabular-nums">
                  {step.n}
                </span>
                <span className="bg-border h-px flex-1" />
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-3 text-pretty">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
