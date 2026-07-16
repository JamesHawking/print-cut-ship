import { useStrings } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'

export function HowItWorks() {
  const strings = useStrings()
  const { n, heading, steps } = strings.process
  return (
    <section id="how-it-works" className="scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} />
        <ol className="mt-12 grid list-none gap-12 p-0 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n}>
              <span
                aria-hidden
                className="text-stroke-faint font-mono text-[clamp(40px,5vw,64px)] leading-none font-bold tabular-nums"
              >
                {step.n}
              </span>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed text-pretty">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <FactoryFigure />
    </section>
  )
}

/** Full-bleed factory-line illustration with an in-image caption bar. */
function FactoryFigure() {
  const strings = useStrings()
  return (
    <figure className="relative m-0">
      <img
        src="/factory-line.webp"
        width={1412}
        height={765}
        loading="lazy"
        alt={strings.hero.figAlt}
        className="block h-auto w-full"
      />
      <figcaption className="from-foreground/55 text-background absolute inset-x-0 bottom-0 flex justify-between gap-4 bg-gradient-to-t to-transparent px-6 py-3.5 font-mono text-[0.65rem] tracking-[0.16em] uppercase">
        <span>{strings.hero.figCaption}</span>
        <span>{strings.hero.figNo}</span>
      </figcaption>
    </figure>
  )
}
