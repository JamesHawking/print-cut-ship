// Shared page header (admin overhaul): mono kicker + title + optional meta
// line, with a right-aligned action slot. EN-only (i18n-exempt directory).

import type { ReactNode } from 'react'

export function PageHeader({
  kicker,
  title,
  meta,
  action,
}: {
  kicker: string
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.2em] uppercase">
          {kicker}
        </p>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {meta && (
          <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            {meta}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}
