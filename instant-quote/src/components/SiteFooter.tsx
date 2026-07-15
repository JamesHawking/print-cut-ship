import { strings } from '@/lib/strings'

export function SiteFooter() {
  const { ctaHeading, ctaBody, ctaButton, note, meta } = strings.footer
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-6 py-16 sm:flex-row sm:items-center sm:justify-between lg:py-20">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-balance sm:text-3xl">
              {ctaHeading}
            </h2>
            <p className="text-muted-foreground mt-2">{ctaBody}</p>
          </div>
          <a
            href="#top"
            className="bg-primary text-primary-foreground hover:shadow-primary/40 inline-flex shrink-0 items-center gap-2 rounded-md px-7 py-3.5 text-sm font-bold transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-lg"
          >
            {ctaButton} ↑
          </a>
        </div>

        <div className="text-muted-foreground flex flex-col gap-3 border-t py-6 font-mono text-xs tracking-widest uppercase sm:flex-row sm:items-center sm:justify-between">
          <span className="text-foreground font-bold">
            {strings.hero.wordmark}
          </span>
          <span>{meta}</span>
        </div>
        <p className="text-muted-foreground/70 pb-8 font-mono text-[0.65rem] tracking-wider uppercase">
          {note}
        </p>
      </div>
    </footer>
  )
}
