import { cn } from '@/lib/utils'
import { useStrings } from '@/lib/i18n'

export type QuoteView = 'editor' | 'simple'

interface Props {
  view: QuoteView
  onChange: (view: QuoteView) => void
}

/**
 * Segmented view switch for the desktop quote workspace: the full editor
 * shell vs the simplified two-column layout. Rendered in the chrome of
 * BOTH views (editor top bar, SiteHeader nav) so it never disappears.
 */
export function ViewSwitch({ view, onChange }: Props) {
  const strings = useStrings()
  const options = [
    { value: 'editor', label: strings.editor.viewEditor },
    { value: 'simple', label: strings.editor.viewSimple },
  ] as const satisfies ReadonlyArray<{ value: QuoteView; label: string }>

  return (
    <div className="bg-card flex items-center gap-0.5 rounded-md border p-0.5 font-mono text-[0.65rem] tracking-widest uppercase">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            // uppercase on the button itself: the CSS reset's
            // `button { text-transform: none }` beats the wrapper's class.
            'cursor-pointer rounded px-2.5 py-1 uppercase transition-colors',
            view === value
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
