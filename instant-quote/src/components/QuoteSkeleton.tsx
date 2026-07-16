import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useStrings } from '@/lib/i18n'

export function QuoteSkeleton() {
  const strings = useStrings()
  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-sm">
          {strings.quote.parsingTitle}
        </p>
        <Skeleton className="h-10 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
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
