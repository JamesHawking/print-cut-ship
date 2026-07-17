import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { formatDecimal } from '@/lib/format'
import { useLocale, useStrings, type Dictionary } from '@/lib/i18n'
import { MATERIALS_SECTION } from '@/content/materials/slugs'
import type { MaterialFamily } from '@/lib/i18n/pl'
import { MATERIALS, type StaticMaterial } from '@/lib/catalog-static'
import { SectionHeading } from './SectionHeading'

// Signal-color coding by material family (TE Pocket-Operator style). The dot
// is echoed in the legend under the table, so colour never carries meaning
// alone. Tokens resolve against the section's `.dark` scope. Keyed by the
// locale-stable family key; display labels come from the dictionary.
export const FAMILY_DOT: Record<MaterialFamily, string> = {
  standard: 'bg-muted-foreground',
  engineering: 'bg-primary',
  specialty: 'bg-info',
}

// Legend order: simplest → most specialised.
export const FAMILY_ORDER = ['standard', 'engineering', 'specialty'] as const

// Shared 4-column grid (md+): name / application / density / from —
// right-aligned numerics, tabular so the two number columns stay on a rail.
// Below md each row reflows to a card: name + rate on top, blurb below,
// density as meta.
const ROW_COLS_MD =
  'md:grid-cols-[minmax(110px,1fr)_minmax(0,2.2fr)_minmax(90px,120px)_minmax(84px,120px)] md:gap-4'

type MaterialId = keyof Dictionary['materials']

export function Materials() {
  const strings = useStrings()
  const locale = useLocale()
  const { n, heading, material, application, density, from, footnote } =
    strings.materialsSection
  return (
    <section
      id="materials"
      className="dark bg-background text-foreground scroll-mt-14"
    >
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} />

        <div className="mt-12">
          {/* column header — hidden on mobile where rows carry their own labels */}
          <div
            className={cn(
              'hidden md:grid',
              ROW_COLS_MD,
              'text-muted-foreground border-b pb-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase',
            )}
          >
            <span>{material}</span>
            <span>{application}</span>
            <span className="text-right">{density}</span>
            <span className="text-right">{from}</span>
          </div>

          {MATERIALS.map((m, i) => (
            <MaterialRow
              key={m.id}
              material={m}
              density={density}
              from={from}
              last={i === MATERIALS.length - 1}
            />
          ))}

          {/* family legend + VAT note */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-[18px] gap-y-2.5 pt-4 font-mono text-[0.6rem] tracking-[0.14em] uppercase md:gap-x-6 md:gap-y-2">
            {FAMILY_ORDER.map((family) => (
              <span key={family} className="inline-flex items-center gap-2">
                <span
                  className={cn('size-1.5 rounded-full', FAMILY_DOT[family])}
                />
                {strings.materialFamilies[family]}
              </span>
            ))}
            <Link
              to="/$locale/$section"
              params={{
                locale,
                section: MATERIALS_SECTION[locale],
              }}
              className="text-primary-text hover:text-foreground font-bold transition-colors"
            >
              {strings.materialsPages.allMaterialsLink}
            </Link>
            <span className="md:ml-auto">{footnote}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function MaterialRow({
  material: p,
  density,
  from,
  last,
}: {
  material: StaticMaterial
  density: string
  from: string
  last: boolean
}) {
  const strings = useStrings()
  const locale = useLocale()
  const m = strings.materials[p.id as MaterialId]
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-[9px] py-5',
        'md:items-baseline md:py-[18px]',
        ROW_COLS_MD,
        'hover:bg-card transition-colors',
        !last && 'border-b',
      )}
    >
      <span className="col-start-1 row-start-1 flex items-center gap-2.5 text-[17px] font-bold tracking-tight md:col-start-auto md:row-start-auto md:text-[clamp(15px,1.6vw,18px)]">
        <span
          className={cn(
            'size-[7px] shrink-0 rounded-full',
            FAMILY_DOT[m.family],
          )}
        />
        {p.label}
        <span className="sr-only">({strings.materialFamilies[m.family]})</span>
      </span>
      <span className="text-muted-foreground col-span-2 row-start-2 text-[13.5px] leading-relaxed text-pretty md:col-span-1 md:row-start-auto">
        {m.tagline}
      </span>
      <span className="text-muted-foreground col-span-2 row-start-3 font-mono text-[13px] tabular-nums md:col-span-1 md:row-start-auto md:text-right">
        <span className="sr-only">{density}: </span>
        {formatDecimal(p.densityGCm3, locale, 2, 2)} g/cm³
      </span>
      <span className="col-start-2 row-start-1 text-right font-mono text-sm font-bold whitespace-nowrap tabular-nums md:col-start-auto md:row-start-auto md:text-[13px]">
        <span className="sr-only">{from} </span>
        {p.plnPerKg} zł/kg
      </span>
    </div>
  )
}
