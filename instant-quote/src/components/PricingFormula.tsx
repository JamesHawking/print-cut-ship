import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { useLocale, useStrings } from '@/lib/i18n'
import { SECTIONS } from '@/content/sections'
import { pricingValues } from '@/content/pricing/data'
import { SectionHeading } from './SectionHeading'

/** "The price is a formula" section — the pricing model, spelled out. */
export function PricingFormula() {
  const strings = useStrings()
  const locale = useLocale()
  const { n, heading, formulaLead, terms, cards } = strings.pricing
  const s = strings.pricingPage
  const values = pricingValues()
  return (
    <section id="pricing" className="scroll-mt-14 border-b">
      <div className="mx-auto max-w-6xl px-4 py-11 sm:px-6 sm:py-15 md:py-24">
        <SectionHeading n={n} title={heading} />

        {/* sm+: the inline equation. ≤sm it breaks mid-term — the stacked
          card below replaces it (Mobile Audit finding 08). */}
        <p className="mt-12 max-w-[900px] font-mono text-[clamp(13px,1.9vw,19px)] leading-[2.15] font-semibold wrap-break-word max-sm:hidden md:leading-[1.9]">
          {formulaLead}
          {terms.map((t) => (
            <Fragment key={t.name}>
              {` ${t.op} `}
              <span className="border-primary border-b-2">{t.name}</span>
              <span className="text-muted-foreground"> {t.unit}</span>
            </Fragment>
          ))}
        </p>

        {/* ≤sm: one term per line on a dark card, then the fee facts as a
          four-row table (ported from the pricing page's fee grid). */}
        <div className="dark bg-background text-foreground mt-7 rounded-lg p-4 font-mono text-[13px] leading-[1.9] font-semibold sm:hidden">
          <p>{formulaLead}</p>
          {terms.map((t) => (
            <p key={t.name} className="pl-3.5">
              {t.op} <span className="border-primary border-b-2">{t.name}</span>{' '}
              <span className="text-muted-foreground">{t.unit}</span>
            </p>
          ))}
        </div>
        <dl className="bg-card mt-3.5 border sm:hidden">
          {(
            [
              [`${values.orderFeePln} zł`, s.feeOrderFee],
              [`${values.minOrderPln} zł`, s.feeMinOrder],
              [
                `${values.shippingFlatPln} zł`,
                s.feeShipping(values.freeShippingThresholdPln),
              ],
              [`${values.vatPct}%`, s.feeVat],
            ] as Array<[string, string]>
          ).map(([value, label]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b px-3.5 py-3 last:border-b-0"
            >
              <dt className="text-muted-foreground text-[13px]">{label}</dt>
              <dd className="font-mono text-sm font-bold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="bg-border mt-12 grid gap-px overflow-hidden rounded-lg border max-sm:hidden sm:grid-cols-3">
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
        <p className="mt-8">
          <Link
            to="/$locale/$section"
            params={{ locale, section: SECTIONS.pricing[locale] }}
            className="text-primary-text hover:text-foreground font-mono text-[0.7rem] font-bold tracking-[0.14em] uppercase transition-colors"
          >
            {strings.pricingPage.fullRateCardLink}
          </Link>
        </p>
      </div>
    </section>
  )
}
