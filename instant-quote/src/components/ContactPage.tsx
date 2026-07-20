import { Mail } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { ContentBreadcrumb } from '@/components/materials/ContentBreadcrumb'
import { Button } from '@/components/ui/button'
import { useStrings } from '@/lib/i18n'

// Support inbox address (plan 06): placeholder default until the domain is
// pinned — the runbook (plans/engineering/runbooks/email-dns.md) provisions
// the real inbox and sets VITE_SUPPORT_EMAIL.
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@microfactory.example'

/** /kontakt · /contact — mailto-only at launch (plan 06; a hosted form is
    deliberately deferred — no new spam surface). */
export function ContactPage() {
  const strings = useStrings()
  const s = strings.contactPage
  return (
    <>
      <SiteHeader variant="landing" />
      <main>
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6">
          <ContentBreadcrumb
            items={[
              { label: strings.materialsPages.breadcrumbHome, to: 'home' },
              { label: s.breadcrumb },
            ]}
          />
          <div className="mt-12 max-w-xl">
            <p className="text-primary-text font-mono text-xs font-bold tracking-[0.14em] uppercase">
              {s.kicker}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {s.heading}
            </h1>
            <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">
              {s.body}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                {s.emailLabel}
              </span>
              <Button asChild size="lg" className="w-fit font-bold">
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Mail className="size-4" />
                  {SUPPORT_EMAIL}
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground mt-6 text-sm">
              {s.responseTime}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">{s.orderNote}</p>
          </div>
        </div>
      </main>
      <SiteFooter ctaSourcePage="contact" />
    </>
  )
}
