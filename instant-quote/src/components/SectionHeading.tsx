import { cn } from '@/lib/utils'

/**
 * Numbered landing-section header (Landing Page v2.dc.html): orange index
 * numeral beside a big uppercase display heading, closed by a hairline.
 * Inherits dark-section tokens when rendered inside a `.dark` scope.
 */
export function SectionHeading({
  n,
  title,
  className,
}: {
  n: string
  title: string
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline gap-5 border-b pb-5', className)}>
      <span
        aria-hidden
        className="text-primary-text font-mono text-[13px] font-bold tabular-nums"
      >
        {n}
      </span>
      <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-none font-black tracking-[-0.03em] uppercase">
        {title}
      </h2>
    </div>
  )
}
