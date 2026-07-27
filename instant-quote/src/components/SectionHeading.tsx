import { cn } from '@/lib/utils'

/**
 * Numbered landing-section header (Landing Page v2.dc.html): orange index
 * numeral beside a big uppercase display heading, closed by a hairline.
 * Inherits dark-section tokens when rendered inside a `.dark` scope.
 */
export function SectionHeading({
  n,
  title,
  titleShort,
  className,
}: {
  /** Omitted for unnumbered codas (the landing FAQ) — the numbering
      authority is NAV_ORDER, and not every section is a nav stop. */
  n?: string
  title: string
  /** Compact ≤sm title (Mobile Audit 1b) — same h2, swapped by breakpoint. */
  titleShort?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline gap-5 border-b pb-5', className)}>
      {n && (
        <span
          aria-hidden
          className="text-primary-text font-mono text-[13px] font-bold tabular-nums"
        >
          {n}
        </span>
      )}
      <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-black tracking-[-0.03em] uppercase max-sm:text-[27px] max-sm:leading-[1.1] sm:leading-none">
        {titleShort ? (
          <>
            <span className="max-sm:hidden">{title}</span>
            <span className="sm:hidden">{titleShort}</span>
          </>
        ) : (
          title
        )}
      </h2>
    </div>
  )
}
