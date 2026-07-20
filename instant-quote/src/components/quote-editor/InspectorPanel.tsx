import { QuoteColumnContent } from './QuoteColumnContent'
import type { Part } from '@/hooks/useParts'
import { useStrings } from '@/lib/i18n'
import type { OrderTotals, PartConfig, PartQuote } from '@/lib/api/client'

interface Props {
  empty: boolean
  selectedPart: Part | null
  selectedQuote: PartQuote | null
  priceQueryPending: boolean
  priceQueryIsError: boolean
  priceQueryError: Error | null
  onRefetchPrice: () => void
  totals: OrderTotals | null
  orderableEntries: Array<{ part: Part; quote: PartQuote }>
  blockedCount: number
  breakdownSwitched: boolean
  pricesExVat: boolean
  onTogglePricesExVat: (value: boolean) => void
  priceEpoch: number
  recalculating: boolean
  onConfigChange: (id: string, patch: Partial<PartConfig>) => void
  onRetryUpload: (id: string) => void
  onOrderClick: () => void
  compareOpen: boolean
  onToggleCompare: () => void
}

/** Desktop editor's right rail: config + price + order for the selected part. */
export function InspectorPanel({
  empty,
  compareOpen,
  onToggleCompare,
  ...content
}: Props) {
  const strings = useStrings()

  return (
    <aside
      aria-label={strings.editor.inspectorLabel}
      className="w-[380px] shrink-0 overflow-y-auto border-l p-4"
    >
      {empty ? (
        <p className="text-muted-foreground px-2 py-6 text-center text-sm">
          {strings.editor.inspectorEmpty}
        </p>
      ) : (
        <QuoteColumnContent
          {...content}
          showDfmBadges={false}
          compareOpen={compareOpen}
          onToggleCompare={onToggleCompare}
        />
      )}
    </aside>
  )
}
