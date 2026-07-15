import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { PRICING, PROCESS_IDS } from '@/lib/pricing-config'

// Signal-color coding by material family (TE Pocket-Operator style).
const FAMILY_DOT: Record<string, string> = {
  Standard: 'bg-muted-foreground',
  Engineering: 'bg-primary',
  Specialty: 'bg-info',
}

export function Materials() {
  const { kicker, heading, sub, density, from } = strings.materialsSection
  return (
    <section className="bg-secondary/40 border-t">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
          {kicker}
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-balance sm:text-4xl">
          {heading}
        </h2>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">
          {sub}
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROCESS_IDS.map((id) => {
            const p = PRICING.processes[id]
            const m = strings.materials[id]
            return (
              <article
                key={id}
                className="bg-card flex flex-col rounded-lg border p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold tracking-tight">
                    {p.label}
                  </h3>
                  <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[0.65rem] tracking-wider uppercase">
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        FAMILY_DOT[m.family],
                      )}
                    />
                    {m.family}
                  </span>
                </div>
                <p className="text-muted-foreground mt-3 flex-1 text-sm text-pretty">
                  {m.tagline}
                </p>
                <dl className="mt-5 flex items-end justify-between border-t pt-3 font-mono">
                  <div>
                    <dt className="text-muted-foreground text-[0.6rem] tracking-wider uppercase">
                      {density}
                    </dt>
                    <dd className="text-sm font-bold tabular-nums">
                      {p.densityGCm3.toFixed(2)} g/cm³
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-muted-foreground text-[0.6rem] tracking-wider uppercase">
                      {from}
                    </dt>
                    <dd className="text-sm font-bold tabular-nums">
                      {p.plnPerKg} zł/kg
                    </dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
