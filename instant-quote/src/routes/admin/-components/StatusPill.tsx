// Canonical status pill (admin overhaul): one mapping for every admin page.
// Semantics: warm colors = needs operator action, green = good, muted = inert.
// EN-only (i18n-exempt directory).

import { cn } from '@/lib/utils'

type PillStyle = { pill: string; dot: string }

export const ORDER_STATUS_STYLE: Record<string, PillStyle> = {
  draft: {
    pill: 'border-border text-muted-foreground',
    dot: 'bg-muted-foreground/50',
  },
  paid: {
    pill: 'border-highlight/40 bg-highlight/10 text-highlight',
    dot: 'bg-highlight',
  },
  in_production: {
    pill: 'border-primary/40 bg-primary/10 text-primary',
    dot: 'bg-primary',
  },
  shipped: {
    pill: 'border-signal/40 bg-signal/10 text-signal',
    dot: 'bg-signal',
  },
  delivered: {
    pill: 'border-border text-muted-foreground',
    dot: 'bg-signal',
  },
  cancelled: {
    pill: 'border-border text-muted-foreground line-through decoration-1',
    dot: 'bg-muted-foreground/50',
  },
  refunded: {
    pill: 'border-destructive/40 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
}

export const STEP_STATUS_STYLE: Record<string, PillStyle> = {
  new: {
    pill: 'border-highlight/40 bg-highlight/10 text-highlight',
    dot: 'bg-highlight',
  },
  quoted: {
    pill: 'border-signal/40 bg-signal/10 text-signal',
    dot: 'bg-signal',
  },
  closed: {
    pill: 'border-border text-muted-foreground',
    dot: 'bg-muted-foreground/50',
  },
}

const FALLBACK: PillStyle = {
  pill: 'border-border text-muted-foreground',
  dot: 'bg-muted-foreground/50',
}

export function StatusPill({
  status,
  styles = ORDER_STATUS_STYLE,
  className,
}: {
  status: string
  styles?: Record<string, PillStyle>
  className?: string
}) {
  const s = styles[status] ?? FALLBACK
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.1em] whitespace-nowrap uppercase',
        s.pill,
        className,
      )}
    >
      <span className={cn('size-2 rounded-[2px]', s.dot)} aria-hidden />
      {status.replace('_', ' ')}
    </span>
  )
}
