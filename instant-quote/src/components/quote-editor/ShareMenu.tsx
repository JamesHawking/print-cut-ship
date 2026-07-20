import { useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Part } from '@/hooks/useParts'
import { useCatalog } from '@/hooks/useApi'
import { useStrings } from '@/lib/i18n'
import type { OrderTotals, PartQuote } from '@/lib/api/client'

interface Props {
  parts: Part[]
  quotes: Map<string, PartQuote>
  totals: OrderTotals
}

/**
 * Share/export menu in the editor top bar. Honest scope: the link is this
 * page's URL (files never leave the browser, so a link can't carry the
 * quote), and the CSV is generated client-side from the live quotes.
 */
export function ShareMenu({ parts, quotes, totals }: Props) {
  const strings = useStrings()
  const catalog = useCatalog()
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flash(key: string, text: string) {
    setFeedback((f) => ({ ...f, [key]: text }))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFeedback({}), 1600)
  }

  function copyLink() {
    try {
      void navigator.clipboard?.writeText(window.location.href)
    } catch {
      // clipboard unavailable (permissions) — feedback still acknowledges
    }
    flash('link', strings.editor.shareCopied)
  }

  function downloadCsv() {
    const rows = [strings.editor.shareCsvHeader]
    for (const part of parts) {
      const quote = quotes.get(part.id)
      if (!quote || quote.blocked) continue
      const material =
        catalog?.processes.find((p) => p.id === part.config.process)?.label ??
        part.config.process
      rows.push(
        [
          part.fileName,
          material,
          part.config.quantity,
          quote.unitPricePln.toFixed(2),
          quote.lineTotalPln.toFixed(2),
        ].join(','),
      )
    }
    rows.push(
      [
        strings.editor.shareCsvTotal,
        '',
        '',
        '',
        totals.grossTotalPln.toFixed(2),
      ].join(','),
    )
    const blob = new Blob([rows.join('\n') + '\n'], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quote.csv'
    a.click()
    URL.revokeObjectURL(url)
    flash('csv', strings.editor.shareSaved)
  }

  const items = [
    {
      key: 'link',
      title: strings.editor.shareCopyLink,
      sub: strings.editor.shareCopyLinkSub,
      onClick: copyLink,
    },
    {
      key: 'csv',
      title: strings.editor.shareCsv,
      sub: strings.editor.shareCsvSub,
      onClick: downloadCsv,
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={strings.editor.share}
        className="border-border bg-card hover:bg-secondary text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
      >
        <Share2 aria-hidden className="size-3" />
        {/* Icon-only below xl — the top bar band is tight (see EditorTopBar). */}
        <span className="hidden xl:inline">{strings.editor.share}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[280px] p-1.5"
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            // Keep the menu open so the inline feedback ("Copied ✓") is seen.
            onSelect={(e) => {
              e.preventDefault()
              item.onClick()
            }}
            className="flex cursor-pointer items-center justify-between gap-2.5 rounded-md px-2.5 py-2"
          >
            <span className="min-w-0">
              <span className="text-foreground block text-[0.8125rem] font-semibold">
                {item.title}
              </span>
              <span className="text-muted-foreground mt-0.5 block truncate text-[0.6875rem]">
                {item.sub}
              </span>
            </span>
            <span className="text-signal shrink-0 font-mono text-[0.59375rem] font-bold tracking-wider uppercase">
              {feedback[item.key] ?? ''}
            </span>
          </DropdownMenuItem>
        ))}
        <p className="text-muted-foreground mx-1.5 mt-1 mb-1.5 border-t pt-2 font-mono text-[0.59375rem] leading-relaxed tracking-wider uppercase">
          {strings.editor.shareNote}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
