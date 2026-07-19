import { OrderPanel } from '@/components/OrderPanel'
import { QuoteCard } from '@/components/QuoteCard'
import { QuoteSkeleton } from '@/components/QuoteSkeleton'
import { StepManualCard } from '@/components/StepManualCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Part } from '@/hooks/useParts'
import { apiErrorMessage } from '@/lib/api/errors'
import type { OrderTotals, PartConfig, PartQuote } from '@/lib/api/client'
import { useStrings } from '@/lib/i18n'

interface Props {
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
}

/**
 * The quote workspace's right-hand column: skeleton / manual-quote / error /
 * QuoteCard, plus the OrderPanel once totals exist. Extracted from quote.tsx
 * so the mobile grid column and the desktop inspector render the same thing.
 */
export function QuoteColumnContent({
  selectedPart,
  selectedQuote,
  priceQueryPending,
  priceQueryIsError,
  priceQueryError,
  onRefetchPrice,
  totals,
  orderableEntries,
  blockedCount,
  breakdownSwitched,
  pricesExVat,
  onTogglePricesExVat,
  priceEpoch,
  recalculating,
  onConfigChange,
  onRetryUpload,
  onOrderClick,
}: Props) {
  const strings = useStrings()

  return (
    <div className="min-w-0 space-y-6">
      {selectedPart?.status === 'parsing' ||
      (selectedPart && !selectedQuote && priceQueryPending) ? (
        <QuoteSkeleton />
      ) : selectedPart?.status === 'error' ? (
        // STEP files that OCCT can't read fall back to a manual quote.
        selectedPart.kind === 'step' ? (
          <StepManualCard part={selectedPart} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">
                {selectedPart.error?.message ?? strings.errors.parseFailed}
              </p>
            </CardContent>
          </Card>
        )
      ) : selectedPart && !selectedQuote && priceQueryIsError ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-destructive text-sm">
              {apiErrorMessage(
                priceQueryError,
                strings,
                strings.errors.priceFailed,
              )}
            </p>
            <Button variant="outline" size="sm" onClick={onRefetchPrice}>
              {strings.orders.retry}
            </Button>
          </CardContent>
        </Card>
      ) : selectedPart && selectedQuote ? (
        <QuoteCard
          part={selectedPart}
          quote={selectedQuote}
          onConfigChange={(patch) => onConfigChange(selectedPart.id, patch)}
          onRetryUpload={() => onRetryUpload(selectedPart.id)}
          priceEpoch={priceEpoch}
          recalculating={recalculating}
        />
      ) : null}

      {totals && orderableEntries.length > 0 && (
        <OrderPanel
          breakdownQuote={
            selectedQuote && !selectedQuote.blocked
              ? selectedQuote
              : orderableEntries[0].quote
          }
          totals={totals}
          pricesExVat={pricesExVat}
          onTogglePricesExVat={onTogglePricesExVat}
          orderableCount={orderableEntries.length}
          excludedCount={blockedCount}
          breakdownForName={
            breakdownSwitched ? orderableEntries[0].part.fileName : undefined
          }
          priceEpoch={priceEpoch}
          recalculating={recalculating}
          onOrderClick={onOrderClick}
        />
      )}
    </div>
  )
}
