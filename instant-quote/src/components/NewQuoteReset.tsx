import { useNavigate } from '@tanstack/react-router'
import { useParts } from '@/hooks/useParts'
import { useLocale, useStrings } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/**
 * "New quote" reset — discards the cart, so confirm first. Orange, not red:
 * data loss, not an error. Extracted from SiteHeader so the desktop editor
 * top bar can offer the same action without the marketing header.
 */
export function NewQuoteReset() {
  const strings = useStrings()
  const locale = useLocale()
  const { parts, clear } = useParts()
  const navigate = useNavigate()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="bg-card hover:bg-secondary cursor-pointer rounded-md border px-3 py-1.5 font-mono text-[0.65rem] tracking-widest uppercase transition-colors"
        >
          {strings.nav.newQuote}
        </button>
      </AlertDialogTrigger>
      {/* Mono/uppercase to match the header's TE language (the vendored
        primitive stays stock sans). */}
      <AlertDialogContent className="font-mono tracking-widest uppercase">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {strings.nav.newQuoteConfirmTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {strings.nav.newQuoteConfirmBody(parts.length)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {strings.nav.newQuoteConfirmCancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              clear()
              void navigate({ to: '/$locale', params: { locale } })
            }}
          >
            {strings.nav.newQuoteConfirmAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
