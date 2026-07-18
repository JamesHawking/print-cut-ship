import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import { formatDecimal, formatPln } from '@/lib/format'
import { useLocale, useStrings, type Dictionary } from '@/lib/i18n'
import {
  MATERIALS_SECTION,
  PUBLISHED_MATERIALS,
  type MaterialSlug,
} from '@/content/materials/slugs'
import type { MaterialFamily } from '@/lib/i18n/pl'
import { MATERIALS, type StaticMaterial } from '@/lib/catalog-static'
import { useOnceInView } from '@/hooks/useOnceInView'
import {
  bracketFallbackOrdered,
  buildBracketRequests,
} from './materials/bracket'
import { shareOfMax } from './materials/scale'
import { SectionHeading } from './SectionHeading'

// Signal-color coding by material family (TE Pocket-Operator style). The dot
// is echoed in the legend chips under the grid, so colour never carries
// meaning alone. Tokens resolve against the section's `.dark` scope. Keyed by
// the locale-stable family key; display labels come from the dictionary.
export const FAMILY_DOT: Record<MaterialFamily, string> = {
  standard: 'bg-muted-foreground',
  engineering: 'bg-primary',
  specialty: 'bg-info',
}

// The family tag printed on each card — colour AND text, so every card is
// self-describing without a trip to the legend.
const FAMILY_TEXT: Record<MaterialFamily, string> = {
  standard: 'text-muted-foreground',
  engineering: 'text-primary-text',
  specialty: 'text-info',
}

// Legend order: simplest → most specialised.
export const FAMILY_ORDER = ['standard', 'engineering', 'specialty'] as const

type MaterialId = keyof Dictionary['materials']

function slugFor(id: string): MaterialSlug | undefined {
  return PUBLISHED_MATERIALS.find((p) => p.id === id)?.slug
}

/**
 * The materials specimen grid: each material as a blunt instrument card, and
 * the hero number is the one no rate table can give — the actual engine price
 * of the demo bracket (the HowItWorks part) in this material, fetched live
 * with checked-in engine-captured fallbacks. The meter under each card plots
 * that price against the section max, so the grid reads as a cost ladder.
 */
export function Materials() {
  const strings = useStrings()
  const locale = useLocale()
  const { n, heading, footnote } = strings.materialsSection
  const { ref, revealed } = useOnceInView()
  // Legend hover spotlight: dims cards of the other families. Decorative only
  // — family is always carried by the on-card tag as text.
  const [spotlight, setSpotlight] = useState<MaterialFamily | null>(null)

  // Live bracket prices: two parallel POSTs (contract maxItems is 5), merged
  // in MATERIALS order. Fired on mount (client-only by construction); the
  // engine-captured fallback carries SSR and the API-down case.
  const bracketQuery = useQuery({
    queryKey: ['materials-bracket-prices'],
    queryFn: async () => {
      const [a, b] = await Promise.all(
        buildBracketRequests().map((body) =>
          api.POST('/api/v1/price', { body }),
        ),
      )
      if (!a.data || !b.data) throw new Error('bracket price fetch failed')
      return [...a.data.parts, ...b.data.parts].map((p) => p.lineTotalPln)
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
  const bracketPrices = bracketQuery.data ?? bracketFallbackOrdered()

  return (
    <section
      id="materials"
      className="dark bg-background text-foreground scroll-mt-14"
    >
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} />

        <div
          ref={ref}
          className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {MATERIALS.map((m, i) => (
            <div
              key={m.id}
              className={cn(
                'motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out',
                revealed
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-2 opacity-0',
              )}
              style={{ transitionDelay: `${i * 45}ms` }}
            >
              <MaterialCard
                material={m}
                bracketPricePln={bracketPrices[i]}
                live={bracketQuery.isSuccess}
                meterPct={shareOfMax(bracketPrices[i], bracketPrices)}
                revealed={revealed}
                meterDelayMs={150 + i * 45}
                spotlight={spotlight}
              />
            </div>
          ))}
          {/* The 8th tile: completes the grid and replaces the inline
              all-materials link. */}
          <div
            className={cn(
              'motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out',
              revealed
                ? 'translate-y-0 opacity-100'
                : 'translate-y-2 opacity-0',
            )}
            style={{ transitionDelay: `${MATERIALS.length * 45}ms` }}
          >
            <Link
              to="/$locale/$section"
              params={{ locale, section: MATERIALS_SECTION[locale] }}
              className="border-foreground/25 hover:border-primary/60 hover:bg-card flex h-full min-h-[120px] flex-col items-center justify-center gap-2 border border-dashed p-5 text-center transition-colors"
            >
              <span className="text-primary-text font-mono text-[11px] font-bold tracking-[0.14em] uppercase">
                {strings.materialsPages.allMaterialsLink}
              </span>
            </Link>
          </div>
        </div>

        {/* Family legend as spotlight chips — bordered so they read as
            controls; hovering one dims the other families' cards. */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-[18px] gap-y-2.5 pt-6 font-mono text-[10px] tracking-[0.14em] uppercase md:gap-x-6 md:gap-y-2">
          {FAMILY_ORDER.map((family, i) => (
            <span
              key={family}
              onMouseEnter={() => setSpotlight(family)}
              onMouseLeave={() => setSpotlight(null)}
              className={cn(
                'inline-flex items-center gap-2 border px-2 py-1 transition-colors',
                i === 0 && '-ml-2',
                spotlight === family
                  ? 'border-foreground/40 text-foreground'
                  : 'border-foreground/15 hover:border-foreground/40 hover:text-foreground',
              )}
            >
              <span
                className={cn('size-1.5 rounded-full', FAMILY_DOT[family])}
              />
              {strings.materialFamilies[family]}
            </span>
          ))}
          <span className="md:ml-auto">{footnote}</span>
        </div>
      </div>
    </section>
  )
}

function MaterialCard({
  material: p,
  bracketPricePln,
  live,
  meterPct,
  revealed,
  meterDelayMs,
  spotlight,
}: {
  material: StaticMaterial
  bracketPricePln: number
  live: boolean
  meterPct: number
  revealed: boolean
  meterDelayMs: number
  spotlight: MaterialFamily | null
}) {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.materialsSection
  const m = strings.materials[p.id as MaterialId]
  const slug = slugFor(p.id)
  const dimmed = spotlight !== null && m.family !== spotlight

  const cardClassName = cn(
    'group/card border-foreground/15 hover:bg-card relative flex h-full flex-col border p-5',
    'transition-[opacity,background-color] duration-300',
    dimmed && 'opacity-40',
  )
  const cells = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xl font-extrabold tracking-tight">{p.label}</span>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 font-mono text-[9px] font-bold tracking-[0.14em] uppercase',
            FAMILY_TEXT[m.family],
          )}
        >
          <span
            aria-hidden
            className={cn('size-[7px] rounded-full', FAMILY_DOT[m.family])}
          />
          {strings.materialFamilies[m.family]}
        </span>
      </span>
      <span className="text-muted-foreground mt-2 block text-[13px] leading-relaxed text-pretty">
        {m.tagline}
      </span>
      <span className="mt-auto block pt-5">
        {/* Flash marks the moment live engine numbers replace the fallback —
            same honesty signal as the demo terminal's PRICE line. */}
        <span
          className={cn(
            'block font-mono text-2xl font-bold tabular-nums',
            live && 'motion-safe:animate-price-flash',
          )}
        >
          {formatPln(bracketPricePln, locale)}
        </span>
        <span className="text-muted-foreground mt-1 block font-mono text-[9px] tracking-[0.14em] uppercase">
          {s.bracketLabel}
        </span>
        <span className="border-foreground/10 text-muted-foreground mt-3 flex items-baseline justify-between border-t pt-2.5 font-mono text-[10px] tabular-nums">
          <span>{p.plnPerKg} zł/kg</span>
          <span>{formatDecimal(p.densityGCm3, locale, 2, 2)} g/cm³</span>
        </span>
        {/* Cost ladder meter: fill = this bracket price vs the section's
            priciest (Iglidur = full rail). One rail per card, same width. */}
        <span
          aria-hidden
          className="bg-foreground/15 group-hover/card:bg-foreground/25 mt-2 block h-[3px] transition-colors"
        >
          <span
            className={cn(
              'block h-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out',
              FAMILY_DOT[m.family],
            )}
            style={{
              width: revealed ? `${meterPct}%` : '0%',
              transitionDelay: `${meterDelayMs}ms`,
            }}
          />
        </span>
        {slug ? (
          <span className="text-primary-text group-hover/card:text-foreground mt-3 block font-mono text-[10px] font-bold tracking-[0.12em] uppercase transition-colors">
            {s.readGuide} →
          </span>
        ) : (
          <span className="text-muted-foreground/70 border-foreground/15 mt-3 block w-fit border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase">
            {s.guideSoon}
          </span>
        )}
      </span>
    </>
  )

  // Cards with a published guide page are whole-card links (internal SEO +
  // the natural "tell me more" target); the rest carry a "guide soon" badge.
  if (slug) {
    return (
      <Link
        to="/$locale/$section/$detail"
        params={{ locale, section: MATERIALS_SECTION[locale], detail: slug }}
        className={cardClassName}
      >
        {cells}
      </Link>
    )
  }
  return <div className={cardClassName}>{cells}</div>
}
