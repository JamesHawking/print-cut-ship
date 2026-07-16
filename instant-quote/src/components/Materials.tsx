import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { MATERIALS, type StaticMaterial } from '@/lib/catalog-static'
import { SectionHeading } from './SectionHeading'

// Signal-color coding by material family (TE Pocket-Operator style). The dot
// is echoed in the legend under the table, so colour never carries meaning
// alone. Tokens resolve against the section's `.dark` scope.
const FAMILY_DOT: Record<string, string> = {
  Standard: 'bg-muted-foreground',
  Engineering: 'bg-primary',
  Specialty: 'bg-info',
}

// Legend order: simplest → most specialised.
const FAMILY_ORDER = ['Standard', 'Engineering', 'Specialty'] as const

// Shared 4-column grid: name / application / density / from — right-aligned
// numerics, tabular so the two number columns stay on a rail.
const ROW_COLS =
  'grid grid-cols-[minmax(110px,1fr)_minmax(0,2.2fr)_minmax(90px,120px)_minmax(84px,120px)] gap-4'

type MaterialId = keyof typeof strings.materials

export function Materials() {
  const { n, heading, material, application, density, from, footnote } =
    strings.materialsSection
  return (
    <section
      id="materials"
      className="dark bg-background text-foreground scroll-mt-14"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading n={n} title={heading} />

        <div className="mt-12">
          {/* column header */}
          <div
            className={cn(
              ROW_COLS,
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
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 font-mono text-[0.6rem] tracking-[0.14em] uppercase">
            {FAMILY_ORDER.map((family) => (
              <span key={family} className="inline-flex items-center gap-2">
                <span
                  className={cn('size-1.5 rounded-full', FAMILY_DOT[family])}
                />
                {family}
              </span>
            ))}
            <span className="ml-auto">{footnote}</span>
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
  const m = strings.materials[p.id as MaterialId]
  return (
    <div
      className={cn(
        ROW_COLS,
        'hover:bg-card items-baseline py-[18px] transition-colors',
        !last && 'border-b',
      )}
    >
      <span className="flex items-center gap-2.5 text-[clamp(15px,1.6vw,18px)] font-bold tracking-tight">
        <span
          className={cn(
            'size-[7px] shrink-0 rounded-full',
            FAMILY_DOT[m.family],
          )}
        />
        {p.label}
        <span className="sr-only">({m.family})</span>
      </span>
      <span className="text-muted-foreground text-[13.5px] leading-relaxed text-pretty">
        {m.tagline}
      </span>
      <span className="text-muted-foreground text-right font-mono text-[13px] tabular-nums">
        <span className="sr-only">{density}: </span>
        {p.densityGCm3.toFixed(2).replace('.', ',')} g/cm³
      </span>
      <span className="text-right font-mono text-[13px] font-bold whitespace-nowrap tabular-nums">
        <span className="sr-only">{from} </span>
        {p.plnPerKg} zł/kg
      </span>
    </div>
  )
}
