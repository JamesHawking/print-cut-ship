import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { track } from '@/lib/funnel'
import { useFilePicker } from '@/hooks/useFilePicker'
import { useLocale, useStrings } from '@/lib/i18n'
import {
  NAV_SECTIONS,
  SECTIONS,
  navNumeral,
  type SectionKey,
} from '@/content/sections'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { LocaleSwitcher } from '../LocaleSwitcher'
import {
  FAMILY_DOT,
  useNavPanelData,
  type NavPanelKey,
  type NavRowMeta,
} from './nav-data'

/**
 * The mobile (<lg) nav inside SiteHeader's Radix Dialog. Row 01 (how it
 * works) and pricing are flat numbered links; materials/compare/blog are
 * accordions over the same useNavPanelData the desktop mega menu renders —
 * tap toggles the sub-rows, the section index is the "all →" footer row.
 * Bottom order: primary quote CTA (opens the native file picker, same
 * funnel as QuoteCta), track-order demoted to a bordered chip, locale last.
 */

const PANEL_KEYS = new Set<NavPanelKey>(['materials', 'compare', 'blog'])

function isPanelKey(key: (typeof NAV_SECTIONS)[number]): key is NavPanelKey {
  return PANEL_KEYS.has(key as NavPanelKey)
}

function RowMeta({ meta }: { meta?: NavRowMeta }) {
  if (!meta) return null
  if (meta.kind === 'family') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[9px] tracking-[0.12em]">
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
      <span className="border-foreground/15 shrink-0 border px-1.5 py-0.5 text-[9px] tracking-[0.12em]">
        {meta.label}
      </span>
    )
  }
  return (
    <span className="shrink-0 text-[9px] tracking-[0.12em] tabular-nums">
      {meta.label}
    </span>
  )
}

const subRowClass =
  'flex items-baseline justify-between gap-3 border-b border-foreground/10 px-1.5 py-3'

function MobileAccordionSection({
  panelKey,
  active,
  onNavigate,
}: {
  panelKey: NavPanelKey
  active: boolean
  onNavigate: () => void
}) {
  const locale = useLocale()
  const data = useNavPanelData(panelKey)
  return (
    <AccordionItem value={panelKey}>
      <AccordionTrigger className="items-center rounded-none px-1.5 py-4 hover:no-underline">
        <span className="flex flex-1 items-center justify-between">
          <span
            className={cn(
              active ? 'text-primary-text font-bold' : 'text-foreground',
            )}
          >
            {data.label}
          </span>
          <span aria-hidden className="text-primary-text">
            {data.numeral}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-0 pl-4">
        <ul>
          {data.rows.map((row) => (
            <li key={row.key}>
              {row.to ? (
                <Link
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: row.to.section,
                    detail: row.to.detail,
                  }}
                  onClick={onNavigate}
                  className={cn(
                    subRowClass,
                    'text-muted-foreground hover:text-foreground transition-colors',
                  )}
                >
                  <span>{row.label}</span>
                  <RowMeta meta={row.meta} />
                </Link>
              ) : (
                <span
                  className={cn(
                    subRowClass,
                    'text-muted-foreground opacity-60',
                  )}
                >
                  <span>{row.label}</span>
                  <RowMeta meta={row.meta} />
                </span>
              )}
            </li>
          ))}
        </ul>
        <Link
          to="/$locale/$section"
          params={{ locale, section: data.footer.section }}
          onClick={onNavigate}
          className="text-primary-text block px-1.5 py-3 font-bold"
        >
          {data.footer.label}
        </Link>
      </AccordionContent>
    </AccordionItem>
  )
}

export function MobileNav({
  routeKey,
  onNavigate,
}: {
  routeKey: SectionKey | null
  onNavigate: () => void
}) {
  const strings = useStrings()
  const locale = useLocale()
  const openFilePicker = useFilePicker()

  return (
    <>
      <Link
        to="/$locale"
        params={{ locale }}
        hash="how-it-works"
        onClick={onNavigate}
        className="text-foreground flex items-center justify-between border-b px-1.5 py-4"
      >
        {strings.nav.howItWorks}
        <span aria-hidden className="text-primary-text">
          {navNumeral('howItWorks')}
        </span>
      </Link>
      <Accordion type="single" collapsible>
        {NAV_SECTIONS.map((key) =>
          isPanelKey(key) ? (
            <MobileAccordionSection
              key={key}
              panelKey={key}
              active={routeKey === key}
              onNavigate={onNavigate}
            />
          ) : (
            <Link
              key={key}
              to="/$locale/$section"
              params={{ locale, section: SECTIONS[key][locale] }}
              onClick={onNavigate}
              aria-current={routeKey === key ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between border-b px-1.5 py-4',
                routeKey === key
                  ? 'text-primary-text font-bold'
                  : 'text-foreground',
              )}
            >
              {strings.nav[key]}
              <span aria-hidden className="text-primary-text">
                {navNumeral(key)}
              </span>
            </Link>
          ),
        )}
      </Accordion>
      <button
        type="button"
        onClick={() => {
          track('cta_upload_clicked', { source_page: 'mobile-menu' })
          openFilePicker()
          onNavigate()
        }}
        className="bg-primary text-primary-foreground mt-3.5 block w-full cursor-pointer rounded-[7px] px-2 py-[15px] text-center font-bold"
      >
        {strings.nav.getQuoteShort} →
      </button>
      <Link
        to="/$locale/login"
        params={{ locale }}
        onClick={onNavigate}
        className="bg-card text-foreground hover:bg-secondary mt-2.5 block rounded-[7px] border px-2 py-[15px] text-center font-bold transition-colors"
      >
        {strings.nav.trackOrder}
      </Link>
      <div className="mt-3.5 flex justify-center">
        <LocaleSwitcher />
      </div>
    </>
  )
}
