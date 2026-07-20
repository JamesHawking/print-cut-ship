import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { NewQuoteReset } from '@/components/NewQuoteReset'
import type { QuoteSummary } from '@/components/SiteHeader'
import type { Part } from '@/hooks/useParts'
import { formatPln } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import type { OrderTotals, PartQuote } from '@/lib/api/client'
import { ShareMenu } from './ShareMenu'

interface Props {
  summary: QuoteSummary | undefined
  totals: OrderTotals | null
  pricesExVat: boolean
  orderableCount: number
  /** Share menu data: every part plus the live quotes. */
  parts: Part[]
  quotes: Map<string, PartQuote>
  onOrderClick: () => void
  /** ViewportToolbar, rendered centered; null when no part is on stage. */
  toolbar: ReactNode
  /** ViewSwitch — editor vs simplified layout. */
  viewSwitch: ReactNode
}

/**
 * Slim editor chrome replacing the marketing SiteHeader on desktop /quote:
 * wordmark + running-quote summary left, viewport toolbar center, total +
 * locale + reset + order CTA right.
 */
export function EditorTopBar({
  summary,
  totals,
  pricesExVat,
  orderableCount,
  parts,
  quotes,
  onOrderClick,
  toolbar,
  viewSwitch,
}: Props) {
  const strings = useStrings()
  const locale = useLocale()

  return (
    <header className="bg-background/90 relative flex h-11 shrink-0 items-center justify-between gap-4 border-b px-4 font-mono text-[0.65rem] tracking-widest uppercase backdrop-blur">
      <div className="flex min-w-0 items-center gap-3.5">
        {/* Explicit way home — the wordmark links there too, but doesn't
          read as a "back" action. Non-destructive: parts persist. */}
        <Link
          to="/$locale"
          params={{ locale }}
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 transition-colors"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          {/* Below xl only the arrow: the 1024–1280 band can't fit the label
            alongside the toolbar and the order cluster. */}
          <span className="hidden xl:inline">{strings.editor.backHome}</span>
        </Link>
        <span aria-hidden className="bg-border h-4 w-px shrink-0" />
        {/* exact: fuzzy matching would mark the home link current on every
          page under /$locale (Link force-sets aria-current when active). */}
        <Link
          to="/$locale"
          params={{ locale }}
          activeOptions={{ exact: true }}
          className="text-foreground hover:text-foreground flex min-w-0 items-center gap-2 font-bold"
        >
          <span
            aria-hidden
            className="bg-signal motion-safe:animate-led size-2 shrink-0 rounded-full shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-signal)_22%,transparent)]"
          />
          {/* Truncates when the bar is tight — sliding under the toolbar
            reads as a rendering bug. */}
          <span className="truncate">{strings.hero.wordmark}</span>
        </Link>
        {summary && (
          // Hidden below xl: in the 1024–1280 band the summary crowds the
          // toolbar into the right cluster (the same data is in the
          // inspector anyway).
          <span className="hidden min-w-0 items-center gap-2.5 xl:flex">
            <span className="bg-foreground text-background shrink-0 rounded px-2 py-1">
              {strings.quote.metaPieces(summary.partCount)}
            </span>
            <span className="text-muted-foreground truncate">
              {summary.materialLabel} · {summary.leadLabel}
              {summary.shipLabel &&
                ` · ${strings.process.ships} ${summary.shipLabel}`}
            </span>
          </span>
        )}
      </div>

      {toolbar && <div className="flex flex-1 justify-center">{toolbar}</div>}

      <div className="flex shrink-0 items-center gap-3">
        {viewSwitch}
        {totals && orderableCount > 0 && (
          <>
            <Button
              size="sm"
              className="font-mono text-[0.65rem] font-bold tracking-widest uppercase"
              onClick={onOrderClick}
            >
              {strings.quote.orderButton(
                formatPln(
                  pricesExVat ? totals.netTotalPln : totals.grossTotalPln,
                  locale,
                ),
              )}
            </Button>
            <ShareMenu parts={parts} quotes={quotes} totals={totals} />
          </>
        )}
        <LocaleSwitcher />
        <NewQuoteReset />
      </div>
    </header>
  )
}
