import { Link } from '@tanstack/react-router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useLocale, useStrings } from '@/lib/i18n'
import { useCatalog } from '@/hooks/useApi'
import { SECTIONS } from '@/content/sections'

export function HowWePriceDialog() {
  const strings = useStrings()
  const locale = useLocale()
  const catalog = useCatalog()

  return (
    <Dialog>
      <DialogTrigger className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2">
        {strings.quote.howWePrice}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{strings.quote.howWePrice}</DialogTitle>
          <DialogDescription>{strings.howWePrice.subtitle}</DialogDescription>
        </DialogHeader>
        {catalog && <PricingCopy catalog={catalog} />}
        <Link
          to="/$locale/$section"
          params={{ locale, section: SECTIONS.pricing[locale] }}
          className="text-primary-text hover:text-foreground font-mono text-[0.7rem] font-bold tracking-[0.14em] uppercase transition-colors"
        >
          {strings.pricingPage.fullRateCardLink}
        </Link>
      </DialogContent>
    </Dialog>
  )
}

function PricingCopy({
  catalog,
}: {
  catalog: NonNullable<ReturnType<typeof useCatalog>>
}) {
  const strings = useStrings()
  const s = strings.howWePrice
  const byId = (id: string) => catalog.processes.find((p) => p.id === id)
  const leadTime = (id: string) => catalog.leadTimes.find((l) => l.id === id)
  const cheapest = byId('pla')
  const priciest = byId('iglidur')
  const economy = leadTime('economy')
  const express = leadTime('express')

  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>{s.weightLead}</strong>
        {s.weightPara({
          shellMm: catalog.fdm.shellThicknessMm,
          infillPct: Math.round(catalog.fdm.infillFraction * 100),
          cheapest: `${cheapest?.label} ${cheapest?.plnPerKg} zł/kg`,
          priciest: `${priciest?.label} ${priciest?.plnPerKg} zł/kg`,
          shellGh: catalog.fdm.shellGramsPerPrintHour,
          infillGh: catalog.fdm.infillGramsPerPrintHour,
        })}
      </p>
      <p>
        <strong>{s.quantityLead}</strong>
        {s.quantityPara}
        <strong>{s.leadTimeLead}</strong>
        {s.leadTimePara({
          economyPct: economy ? Math.round((1 - economy.mult) * 100) : 10,
          expressPct: express ? Math.round((express.mult - 1) * 100) : 30,
        })}
      </p>
      <p>
        {s.feesPara({
          minPart: catalog.minPartPricePln,
          minOrder: catalog.minOrderPln,
          orderFee: catalog.orderFeePln,
          shippingFlat: catalog.shippingFlatPln,
          freeThreshold: catalog.freeShippingThresholdPln,
          vatPct: Math.round(catalog.vatRate * 100),
        })}
      </p>
    </div>
  )
}
