import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/i18n'
import { NavigationMenuLink } from '@/components/ui/navigation-menu'
import {
  FAMILY_DOT,
  useNavPanelData,
  type NavPanelKey,
  type NavRowMeta,
} from './nav-data'

/**
 * The three mega-menu panels (materials / compare / blog) — pure renderers
 * over useNavPanelData (nav-data.ts). Square TE-blunt language echoing the
 * mobile menu: hairline rows, mono microcopy, an orange section numeral with
 * a dashed rule as the panel nameplate. Rows are real router links via
 * NavigationMenuLink asChild, so Radix keeps its keyboard contract inside
 * the menu. Row classes live on NavigationMenuLink itself — cn()/twMerge
 * then resolves the shadcn base (flex-col, hover:bg-accent) in our favour.
 */

// Self-contained panel context — the bar's mono/uppercase is NOT inherited
// into the Radix viewport, so each panel sets its own.
const panelClass = 'bg-background font-mono uppercase'

function PanelNameplate({
  n,
  label,
  count,
}: {
  n: string
  label: string
  count: number
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 border-b px-4 py-2.5 text-[9px] font-bold tracking-[0.16em]">
      <span aria-hidden className="text-primary-text">
        {n}
      </span>
      {label}
      <span
        aria-hidden
        className="border-foreground/10 flex-1 border-t border-dashed"
      />
      {/* List size at a glance: materials shows the full count (the panel IS
          the whole catalog), blog/compare the published total. */}
      <span aria-hidden className="tabular-nums">
        {String(count).padStart(2, '0')}
      </span>
    </div>
  )
}

function PanelFooter({ label, section }: { label: string; section: string }) {
  const locale = useLocale()
  return (
    <NavigationMenuLink
      asChild
      className="text-primary-text hover:bg-secondary/60 hover:text-foreground block rounded-none px-4 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase transition-colors"
    >
      <Link to="/$locale/$section" params={{ locale, section }}>
        {label}
      </Link>
    </NavigationMenuLink>
  )
}

const rowClass =
  'hover:bg-secondary/60 hover:text-foreground flex-row items-center justify-between gap-3 rounded-none border-b px-4 py-2.5 transition-colors'

function MetaTag({ meta }: { meta: NavRowMeta }) {
  if (meta.kind === 'family') {
    return (
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[9px] tracking-[0.12em] whitespace-nowrap">
        <span
          aria-hidden
          className={cn('size-[7px] rounded-full', FAMILY_DOT[meta.family])}
        />
        {meta.label}
      </span>
    )
  }
  if (meta.kind === 'soon') {
    return (
      <span className="text-muted-foreground/70 border-foreground/15 shrink-0 border px-1.5 py-0.5 text-[9px] tracking-[0.12em] whitespace-nowrap">
        {meta.label}
      </span>
    )
  }
  return null
}

function PanelShell({
  panelKey,
  widthClass,
  children,
}: {
  panelKey: NavPanelKey
  widthClass: string
  children: (data: ReturnType<typeof useNavPanelData>) => React.ReactNode
}) {
  const data = useNavPanelData(panelKey)
  return (
    <div className={cn(panelClass, widthClass)}>
      <PanelNameplate n={data.numeral} label={data.label} count={data.count} />
      {children(data)}
      <PanelFooter label={data.footer.label} section={data.footer.section} />
    </div>
  )
}

export function MaterialsPanel() {
  const locale = useLocale()
  return (
    <PanelShell panelKey="materials" widthClass="w-[min(560px,84vw)]">
      {(data) => (
        <ul className="grid grid-cols-2 gap-x-0">
          {data.rows.map((row) => (
            <li key={row.key}>
              {row.to ? (
                <NavigationMenuLink asChild className={rowClass}>
                  <Link
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: row.to.section,
                      detail: row.to.detail,
                    }}
                  >
                    <span className="text-[13px] font-bold whitespace-nowrap">
                      {row.label}
                    </span>
                    {row.meta && <MetaTag meta={row.meta} />}
                  </Link>
                </NavigationMenuLink>
              ) : (
                // Disabled row (unpublished material): no link hover.
                <span
                  className={cn(
                    rowClass,
                    'flex opacity-60 hover:bg-transparent',
                  )}
                >
                  <span className="text-[13px] font-bold whitespace-nowrap">
                    {row.label}
                  </span>
                  {row.meta && <MetaTag meta={row.meta} />}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}

export function ComparePanel() {
  const locale = useLocale()
  return (
    <PanelShell panelKey="compare" widthClass="w-[min(400px,84vw)]">
      {(data) => (
        <ul>
          {data.rows.map((row) => (
            <li key={row.key}>
              <NavigationMenuLink asChild className={rowClass}>
                <Link
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: row.to!.section,
                    detail: row.to!.detail,
                  }}
                >
                  <span className="text-[13px] font-bold whitespace-nowrap">
                    {row.label}
                  </span>
                </Link>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}

export function BlogPanel() {
  const locale = useLocale()
  return (
    <PanelShell panelKey="blog" widthClass="w-[min(460px,84vw)]">
      {(data) => (
        <ul>
          {data.rows.map((row) => (
            <li key={row.key}>
              <NavigationMenuLink
                asChild
                className={cn(rowClass, 'flex-col items-start gap-1')}
              >
                <Link
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: row.to!.section,
                    detail: row.to!.detail,
                  }}
                >
                  <span className="text-muted-foreground text-[9px] tracking-[0.14em] tabular-nums">
                    {row.meta?.kind === 'date' ? row.meta.label : null}
                  </span>
                  <span className="text-[13px] leading-snug font-bold text-pretty">
                    {row.label}
                  </span>
                </Link>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
