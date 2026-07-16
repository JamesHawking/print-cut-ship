import { Box } from 'lucide-react'
import { formatDims } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'

export function ViewerFallback({
  bboxMm,
}: {
  bboxMm?: { x: number; y: number; z: number }
}) {
  const strings = useStrings()
  const locale = useLocale()
  return (
    <div className="bg-muted/40 text-muted-foreground flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center">
      <Box className="size-8" />
      <p className="text-sm">{strings.errors.webglMissing}</p>
      {bboxMm && (
        <p className="text-foreground text-sm font-medium tabular-nums">
          {formatDims(bboxMm, locale)}
        </p>
      )}
    </div>
  )
}
