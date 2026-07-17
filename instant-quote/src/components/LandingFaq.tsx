import { useStrings } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

/**
 * Landing FAQ (04) — objection-handling between the pricing section and the
 * footer CTA. Items also feed the route's FAQPage JSON-LD (they come from
 * the same dictionary array, so page and schema can never drift).
 */
export function LandingFaq() {
  const { n, heading, items } = useStrings().landingFaq
  return (
    <section id="faq" className="scroll-mt-14 border-b">
      <div className="mx-auto max-w-6xl px-4 py-15 sm:px-6 md:py-24">
        <SectionHeading n={n} title={heading} />
        <Accordion type="single" collapsible className="mt-8 max-w-3xl">
          {items.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left text-[15px] font-bold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed text-pretty">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
