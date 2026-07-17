import type { ComponentProps, ComponentType } from 'react'
import { QuoteCta } from '@/components/QuoteCta'

/**
 * Element mapping for article MDX bodies, styled to the site's design
 * system (no typography plugin — rhythm lives here). rehype-autolink-
 * headings wraps each h2/h3 text in an <a href="#id">, so headings style
 * their inner anchor. `CtaBreak` is the author-placed compact quote CTA —
 * convention: exactly one per article, right after the second h2
 * (enforced by content.spec.ts).
 */
export function mdxComponents(
  sourcePage: string,
): Record<string, ComponentType<never>> {
  const components = {
    h2: (props: ComponentProps<'h2'>) => (
      <h2
        className="[&>a:hover]:decoration-primary mt-14 scroll-mt-24 text-2xl font-extrabold tracking-tight [&>a]:text-inherit [&>a]:no-underline [&>a:hover]:underline [&>a:hover]:underline-offset-4"
        {...props}
      />
    ),
    h3: (props: ComponentProps<'h3'>) => (
      <h3
        className="[&>a:hover]:decoration-primary mt-10 scroll-mt-24 text-lg font-bold tracking-tight [&>a]:text-inherit [&>a]:no-underline [&>a:hover]:underline [&>a:hover]:underline-offset-4"
        {...props}
      />
    ),
    p: (props: ComponentProps<'p'>) => (
      <p className="mt-5 text-[15px] leading-relaxed text-pretty" {...props} />
    ),
    ul: (props: ComponentProps<'ul'>) => (
      <ul
        className="marker:text-primary mt-5 list-disc space-y-2 pl-5 text-[15px] leading-relaxed"
        {...props}
      />
    ),
    ol: (props: ComponentProps<'ol'>) => (
      <ol
        className="marker:text-muted-foreground mt-5 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed marker:font-mono"
        {...props}
      />
    ),
    table: (props: ComponentProps<'table'>) => (
      <div className="mt-6 overflow-x-auto">
        <table
          className="[&_th]:text-muted-foreground w-full min-w-[480px] border-collapse text-left text-sm [&_td]:border-b [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_td]:tabular-nums [&_th]:border-b [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-mono [&_th]:text-[0.65rem] [&_th]:tracking-[0.14em] [&_th]:uppercase"
          {...props}
        />
      </div>
    ),
    figure: (props: ComponentProps<'figure'>) => (
      <figure className="mt-8" {...props} />
    ),
    figcaption: (props: ComponentProps<'figcaption'>) => (
      <figcaption
        className="text-muted-foreground mt-3 font-mono text-[0.65rem] tracking-[0.14em] uppercase"
        {...props}
      />
    ),
    pre: (props: ComponentProps<'pre'>) => (
      <pre
        className="bg-card mt-6 overflow-x-auto rounded-lg border p-4 font-mono text-[13px] leading-relaxed"
        {...props}
      />
    ),
    code: (props: ComponentProps<'code'>) => (
      <code className="font-mono text-[0.9em]" {...props} />
    ),
    a: (props: ComponentProps<'a'>) => (
      <a
        className="text-primary-text hover:text-foreground decoration-primary/50 font-medium underline underline-offset-4 transition-colors"
        {...props}
      />
    ),
    blockquote: (props: ComponentProps<'blockquote'>) => (
      <blockquote
        className="text-muted-foreground mt-6 border-l-2 pl-5 italic"
        {...props}
      />
    ),
    hr: (props: ComponentProps<'hr'>) => <hr className="my-10" {...props} />,
    CtaBreak: () => (
      <div className="mt-12">
        <QuoteCta variant="compact" sourcePage={sourcePage} />
      </div>
    ),
  }
  return components as Record<string, ComponentType<never>>
}
