import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Stands in for QuoteCard while a part is measured, so it takes the same
 * chrome: flush on the editor's inspector panel, a card in the page column.
 * A card here and flush content after would jump the moment the price lands.
 */
export function QuoteSkeleton({ flush = false }: { flush?: boolean }) {
  const strings = useStrings()
  return (
    <Card
      className={cn(
        flush && 'gap-5 rounded-none border-0 bg-transparent py-0 shadow-none',
      )}
    >
      <CardHeader className={cn(flush && 'px-0')}>
        <p className="text-muted-foreground text-sm">
          {strings.quote.parsingTitle}
        </p>
        <Skeleton className="h-10 w-40" />
      </CardHeader>
      <CardContent className={cn('space-y-4', flush && 'px-0')}>
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-10" />
          <Skeleton className="h-8 w-10" />
          <Skeleton className="h-8 w-10" />
          <Skeleton className="h-8 w-10" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  )
}
