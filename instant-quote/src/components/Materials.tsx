import { cn } from '@/lib/utils'
import { strings } from '@/lib/strings'
import { MATERIALS, type StaticMaterial } from '@/lib/catalog-static'

// Signal-color coding by material family (TE Pocket-Operator style). The dot is
// always paired with the family name, so colour never carries meaning alone.
const FAMILY_DOT: Record<string, string> = {
  Standard: 'bg-muted-foreground',
  Engineering: 'bg-primary',
  Specialty: 'bg-info',
}

// Families ordered simplest → most specialised; materials keep config order.
const FAMILY_ORDER = ['Standard', 'Engineering', 'Specialty'] as const

// Shared 4-column grid: name / application / density / from — right-aligned
// numerics, tabular so the two number columns stay on a rail.
const ROW_COLS =
  'grid grid-cols-[minmax(90px,0.9fr)_minmax(0,2fr)_minmax(78px,100px)_minmax(74px,100px)] gap-4'

type MaterialId = keyof typeof strings.materials

const groups = FAMILY_ORDER.map((family) => ({
  family,
  items: MATERIALS.filter(
    (m) => strings.materials[m.id as MaterialId].family === family,
  ),
})).filter((g) => g.items.length > 0)

export function Materials() {
  const {
    kicker,
    heading,
    sub,
    material,
    application,
    density,
    from,
    footnote,
  } = strings.materialsSection
  return (
    <section id="materials" className="bg-secondary/40 scroll-mt-14 border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
          {kicker}
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-balance sm:text-4xl">
          {heading}
        </h2>
        <p className="text-muted-foreground mt-4 max-w-xl text-lg text-pretty">
          {sub}
        </p>

        <div className="bg-card mt-12 overflow-hidden rounded-lg border">
          {/* column header */}
          <div
            className={cn(
              ROW_COLS,
              'bg-secondary text-muted-foreground border-b px-5 py-2.5 font-mono text-[0.6rem] tracking-wider uppercase',
            )}
          >
            <span>{material}</span>
            <span>{application}</span>
            <span className="text-right">{density}</span>
            <span className="text-right">{from}</span>
          </div>

          {groups.map((group) => (
            <div key={group.family}>
              {/* family group header */}
              <div className="bg-secondary/60 flex items-center gap-2 border-b px-5 py-2.5">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    FAMILY_DOT[group.family],
                  )}
                />
                <span className="font-mono text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                  {group.family}
                </span>
                <span className="text-muted-foreground font-mono text-[0.62rem] tracking-[0.18em]">
                  — {String(group.items.length).padStart(2, '0')}
                </span>
              </div>
              {group.items.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  density={density}
                  from={from}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 font-mono text-[0.6rem] tracking-wider uppercase">
          {footnote}
        </p>
      </div>
    </section>
  )
}

function MaterialRow({
  material: p,
  density,
  from,
}: {
  material: StaticMaterial
  density: string
  from: string
}) {
  const m = strings.materials[p.id as MaterialId]
  return (
    <div
      className={cn(
        ROW_COLS,
        'hover:bg-primary/[0.045] items-baseline border-b px-5 py-3.5 transition-colors last:border-b-0',
      )}
    >
      <span className="text-[0.95rem] font-bold tracking-tight">{p.label}</span>
      <span className="text-muted-foreground text-sm leading-snug text-pretty">
        {m.tagline}
      </span>
      <span className="text-right font-mono text-[0.8rem] tabular-nums">
        <span className="sr-only">{density}: </span>
        {p.densityGCm3.toFixed(2).replace('.', ',')} g/cm³
      </span>
      <span className="text-right font-mono text-[0.8rem] font-bold whitespace-nowrap tabular-nums">
        <span className="sr-only">{from} </span>
        {p.plnPerKg} zł/kg
      </span>
    </div>
  )
}
