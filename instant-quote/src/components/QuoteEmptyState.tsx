import { DropZone } from '@/components/DropZone'
import { useStrings } from '@/lib/i18n'

interface Props {
  onFiles: (files: File[]) => void
  onUrl: (url: string) => void
  urlPending?: boolean
}

// Shown instead of the workspace when no parts are loaded — a refresh, a deep
// link, or removing the last part lands here rather than bouncing to the
// landing page.
export function QuoteEmptyState({ onFiles, onUrl, urlPending }: Props) {
  const strings = useStrings()
  return (
    <div className="animate-in fade-in relative flex-1 duration-300">
      <div className="blueprint-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-16">
        <p className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.2em] uppercase">
          {strings.quoteEmpty.kicker}
        </p>
        <DropZone
          variant="hero"
          onFiles={onFiles}
          onUrl={onUrl}
          urlPending={urlPending}
        />
        <p className="text-muted-foreground text-center text-sm">
          {strings.quoteEmpty.hint}
        </p>
      </div>
    </div>
  )
}
