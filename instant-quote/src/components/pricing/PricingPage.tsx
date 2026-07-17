import { Link } from '@tanstack/react-router'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { SectionHeading } from '@/components/SectionHeading'
import { QuoteCta } from '@/components/QuoteCta'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { PriceSlider } from './PriceSlider'
import { useLocale, useStrings } from '@/lib/i18n'
import {
  formatDecimal,
  formatPercent,
  formatPln,
  formatWeekday,
} from '@/lib/format'
import {
  MATERIALS_SECTION,
  PUBLISHED_MATERIALS,
} from '@/content/materials/slugs'
import { pricingCopy } from '@/content/pricing/copy'
import { pricingFaq } from '@/content/pricing/faq'
import {
  DISCOUNT_EXAMPLE,
  MIN_ORDER_EXAMPLE,
  PRICING_CATALOG,
  RATE_CARD,
  RATE_CARD_VOLUMES,
  SHIP_DATE_EXAMPLES,
  pricingValues,
} from '@/content/pricing/data'

/**
 * Calendar-week offset (Monday-based) between two ISO dates, so the ship
 * label can say "next week" / "in two weeks" and disambiguate lead times
 * that land on the same weekday.
 */
function weeksBetween(fromIso: string, toIso: string): number {
  const mondayOf = (iso: string) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
    return d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000
  }
  return Math.round((mondayOf(toIso) - mondayOf(fromIso)) / (7 * 86_400_000))
}

/** The published rate card (seo_prompts/03) — every number from the engine. */
export function PricingPage() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.pricingPage
  const copy = pricingCopy(locale)
  const values = pricingValues()
  const faq = pricingFaq(locale)
  const leadNames: Record<string, string> = {
    economy: strings.config.economy,
    standard: strings.config.standard,
    express: strings.config.express,
  }

  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        {/* poster hero (design 2b): the formula in display type, the
            transparency claim + fee spec grid beside it */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-16">
            <ContentBreadcrumb
              items={[
                {
                  label: strings.materialsPages.breadcrumbHome,
                  href: `/${locale}`,
                },
                { label: s.breadcrumb },
              ]}
            />
            <div className="mt-9 grid gap-x-16 gap-y-12 lg:grid-cols-[1.5fr_1fr]">
              <div>
                <p className="text-[clamp(2.4rem,6vw,4.75rem)] leading-[1.04] font-black tracking-[-0.035em] uppercase">
                  <span className="block">
                    {strings.pricing.formulaLead} {strings.pricing.terms[0].op}
                  </span>
                  {strings.pricing.terms.map((t, i) => (
                    <span key={t.name} className="block">
                      {i > 0 && `${t.op} `}
                      <span className="[box-shadow:inset_0_-0.375rem_0_0_var(--color-primary)]">
                        {t.name}
                      </span>{' '}
                      <span className="text-muted-foreground font-mono text-[15px] font-normal tracking-normal normal-case">
                        {t.unit}
                      </span>
                    </span>
                  ))}
                </p>
                <p className="text-muted-foreground mt-8 max-w-xl text-[14px] leading-relaxed text-pretty">
                  {copy.formulaIntro}
                </p>
              </div>
              <div className="flex flex-col justify-between gap-8">
                <div>
                  <h1 className="text-primary-text font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                    {strings.pricing.heading}
                  </h1>
                  <div className="mt-4 space-y-3.5">
                    {copy.intro.map((paragraph) => (
                      <p
                        key={paragraph.slice(0, 32)}
                        className="text-muted-foreground text-[15px] leading-relaxed text-pretty"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
                <dl className="grid grid-cols-2 border-t">
                  {(
                    [
                      [`${values.minOrderPln} zł`, s.feeMinOrder, true, true],
                      [`${values.orderFeePln} zł`, s.feeOrderFee, false, true],
                      [
                        `${values.shippingFlatPln} zł`,
                        s.feeShipping(values.freeShippingThresholdPln),
                        true,
                        false,
                      ],
                      [`${values.vatPct}%`, s.feeVat, false, false],
                    ] as Array<[string, string, boolean, boolean]>
                  ).map(([value, label, borderR, borderB]) => (
                    <div
                      key={label}
                      className={`py-4 ${borderR ? 'border-r pr-4' : 'pl-4'} ${
                        borderB ? 'border-b' : 'pb-0'
                      }`}
                    >
                      <dd className="font-mono text-xl font-bold tabular-nums">
                        {value}
                      </dd>
                      <dt className="text-muted-foreground mt-1.5 font-mono text-[0.5625rem] tracking-[0.14em] uppercase">
                        {label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* compact slider strip — the live instrument between poster and card */}
        <section className="bg-card border-b">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <PriceSlider />
          </div>
        </section>

        {/* 01 — rate card */}
        <section className="dark bg-background text-foreground border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="01" title={s.rateCardTitle} />
            <p className="text-muted-foreground mt-6 max-w-2xl text-[14px] leading-relaxed text-pretty">
              {copy.rateCardNote(values)}
            </p>
            <div className="mt-8 overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="text-muted-foreground grid grid-cols-[minmax(160px,1.6fr)_repeat(5,minmax(80px,1fr))] gap-4 border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
                  <span>{strings.materialsSection.material}</span>
                  <span className="text-right">zł/kg</span>
                  <span className="text-right">zł/h</span>
                  {RATE_CARD_VOLUMES.map((volume) => (
                    <span key={volume} className="text-right">
                      {s.rateCardVolumeHeader(volume)}
                    </span>
                  ))}
                </div>
                {PRICING_CATALOG.materials.map((material) => {
                  const published = PUBLISHED_MATERIALS.find(
                    (m) => m.id === material.id,
                  )
                  const name = published ? (
                    <Link
                      to="/$locale/$section/$detail"
                      params={{
                        locale,
                        section: MATERIALS_SECTION[locale],
                        detail: published.slug,
                      }}
                      className="text-primary-text hover:text-foreground font-bold transition-colors"
                    >
                      {material.label} →
                    </Link>
                  ) : (
                    <span className="font-bold">{material.label}</span>
                  )
                  return (
                    <div
                      key={material.id}
                      className="hover:bg-card grid grid-cols-[minmax(160px,1.6fr)_repeat(5,minmax(80px,1fr))] items-baseline gap-4 border-b py-4 transition-colors"
                    >
                      <span className="text-[15px]">{name}</span>
                      <span className="text-muted-foreground text-right font-mono text-[13px] tabular-nums">
                        {material.plnPerKg}
                      </span>
                      <span className="text-muted-foreground text-right font-mono text-[13px] tabular-nums">
                        {formatDecimal(material.plnPerHour, locale, 2)}
                      </span>
                      {RATE_CARD_VOLUMES.map((volume) => (
                        <span
                          key={volume}
                          className="text-right font-mono text-[13px] font-bold whitespace-nowrap tabular-nums"
                        >
                          {formatPln(
                            RATE_CARD[material.id][String(volume)],
                            locale,
                          )}
                        </span>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-10">
              <QuoteCta variant="compact" sourcePage="pricing" />
            </div>
          </div>
        </section>

        {/* 02 — quantity discounts + worked example */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="02" title={s.discountsTitle} />
            <p className="text-muted-foreground mt-6 max-w-2xl text-[14px] leading-relaxed text-pretty">
              {copy.discountIntro(values)}
            </p>
            <p className="text-muted-foreground mt-8 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
              {s.discountExampleLabel(
                strings.materialsPages.partNames.enclosure,
              )}
            </p>
            <div className="mt-3 max-w-2xl overflow-hidden rounded-md border">
              <div className="bg-secondary text-muted-foreground grid grid-cols-4 gap-3 border-b px-3.5 py-2 font-mono text-[0.5625rem] tracking-[0.14em] uppercase">
                <span>{strings.priceBreak.qty}</span>
                <span className="text-right">{s.headerDiscount}</span>
                <span className="text-right">
                  {strings.priceBreak.unitPrice}
                </span>
                <span className="text-right">{s.headerLine}</span>
              </div>
              {DISCOUNT_EXAMPLE.map((row, i) => {
                const tier = PRICING_CATALOG.discountTiers.find(
                  (t) => t.quantity === row.quantity,
                )
                return (
                  <div
                    key={row.quantity}
                    className={`grid grid-cols-4 gap-3 px-3.5 py-2 text-[0.8125rem] ${
                      i < DISCOUNT_EXAMPLE.length - 1 ? 'border-b' : ''
                    } bg-card`}
                  >
                    <span className="tabular-nums">{row.quantity}</span>
                    <span className="text-muted-foreground text-right font-mono tabular-nums">
                      {formatPercent(tier?.fraction ?? 0)}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {formatPln(row.unitPln, locale)}
                    </span>
                    <span className="text-right font-mono font-bold tabular-nums">
                      {formatPln(row.linePln, locale)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 03 — lead times + anchored ship-date scenarios */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="03" title={s.leadTimesTitle} />
            <p className="text-muted-foreground mt-6 max-w-2xl text-[14px] leading-relaxed text-pretty">
              {copy.leadIntro(values)}
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {SHIP_DATE_EXAMPLES.map((example) => {
                const [, time] = example.orderIso.split('T')
                return (
                  <div key={example.orderIso} className="rounded-lg border p-5">
                    <p className="font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                      {s.orderedLabel(
                        formatWeekday(example.orderIso, locale),
                        time,
                      )}
                    </p>
                    <dl className="mt-4 space-y-2.5">
                      {PRICING_CATALOG.leadTimes.map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-baseline justify-between gap-4 text-[0.8125rem]"
                        >
                          <dt>
                            {s.shipsLabel(
                              leadNames[lead.id] ?? lead.id,
                              lead.businessDays,
                              formatWeekday(example.shipIso[lead.id], locale),
                              weeksBetween(
                                example.orderIso,
                                example.shipIso[lead.id],
                              ),
                            )}
                          </dt>
                          <dd className="text-muted-foreground font-mono text-[0.6875rem] tabular-nums">
                            ×{formatDecimal(lead.mult, locale, 2)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 04 — minimums & shipping, worked example */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="04" title={s.minimumsTitle} />
            <p className="text-muted-foreground mt-6 max-w-2xl text-[14px] leading-relaxed text-pretty">
              {copy.minimumsIntro(values)}
            </p>
            <p className="text-muted-foreground mt-4 max-w-2xl text-[14px] leading-relaxed text-pretty">
              {copy.minOrderExampleNote(values)}
            </p>
            <div className="mt-8 max-w-md rounded-lg border p-5">
              <p className="font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                {s.minOrderExampleTitle}
              </p>
              <dl className="mt-4 space-y-2">
                {(
                  [
                    [
                      `${strings.materialsPages.partNames.bracket} · PETG`,
                      MIN_ORDER_EXAMPLE.unitPln,
                    ],
                    [
                      strings.orderPanel.minOrderTopUp,
                      MIN_ORDER_EXAMPLE.minOrderTopUpPln,
                    ],
                    [
                      strings.orderPanel.orderFee,
                      MIN_ORDER_EXAMPLE.orderFeePln,
                    ],
                    [
                      strings.orderPanel.shipping,
                      MIN_ORDER_EXAMPLE.shippingPln,
                    ],
                  ] as Array<[string, number]>
                ).map(([label, amount]) => (
                  <div
                    key={label}
                    className="text-muted-foreground flex items-baseline justify-between gap-4 text-[0.8125rem]"
                  >
                    <dt className="min-w-0 truncate">{label}</dt>
                    <dd className="font-mono whitespace-nowrap tabular-nums">
                      {formatPln(amount, locale)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t pt-2.5 text-[0.8125rem] font-bold">
                  <dt>{strings.orderPanel.totalIncVat}</dt>
                  <dd className="font-mono whitespace-nowrap tabular-nums">
                    {formatPln(MIN_ORDER_EXAMPLE.grossTotalPln, locale)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* 05 — no hidden costs + honest comparison */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="05" title={s.noHiddenTitle} />
            <div className="mt-8 max-w-3xl space-y-5">
              {copy.noHidden(values).map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-muted-foreground text-[15px] leading-relaxed text-pretty"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <h3 className="mt-12 text-xl font-extrabold tracking-tight">
              {s.comparisonTitle}
            </h3>
            <div className="mt-4 max-w-3xl space-y-5">
              {copy.comparison.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-muted-foreground text-[15px] leading-relaxed text-pretty"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* 06 — FAQ */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
            <SectionHeading n="06" title={s.faqTitle} />
            <Accordion type="single" collapsible className="mt-8 max-w-3xl">
              {faq.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="text-left text-[15px] font-bold">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed text-pretty">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
      <SiteFooter ctaSourcePage="pricing" />
    </>
  )
}
