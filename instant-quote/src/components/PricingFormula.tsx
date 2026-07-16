import { Fragment } from 'react'
import { useStrings } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'

/** "The price is a formula" section — the pricing model, spelled out. */
export function PricingFormula() {
  const strings = useStrings()
  const { n, heading, formulaLead, terms, cards } = strings.pricing
  return (
    <section id="pricing" className="scroll-mt-14 border-b">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} />

        <p className="mt-12 max-w-[900px] font-mono text-[clamp(13px,1.9vw,19px)] leading-[2.15] font-semibold wrap-break-word md:leading-[1.9]">
          {formulaLead}
          {terms.map((t) => (
            <Fragment key={t.name}>
              {` ${t.op} `}
              <span className="border-primary border-b-2">{t.name}</span>
              <span className="text-muted-foreground"> {t.unit}</span>
            </Fragment>
          ))}
        </p>

        <div className="bg-border mt-12 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="bg-card p-6">
              <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase">
                {c.title}
              </p>
              <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed text-pretty">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
