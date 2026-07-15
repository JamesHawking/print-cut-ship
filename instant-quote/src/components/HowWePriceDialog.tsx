import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { strings } from '@/lib/strings'
import { useCatalog } from '@/hooks/useApi'

export function HowWePriceDialog() {
  const catalog = useCatalog()

  return (
    <Dialog>
      <DialogTrigger className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2">
        {strings.quote.howWePrice}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How we price</DialogTitle>
          <DialogDescription>
            No hidden math. Every quote is built from these numbers.
          </DialogDescription>
        </DialogHeader>
        {catalog && <PricingCopy catalog={catalog} />}
      </DialogContent>
    </Dialog>
  )
}

function PricingCopy({
  catalog,
}: {
  catalog: NonNullable<ReturnType<typeof useCatalog>>
}) {
  const byId = (id: string) => catalog.processes.find((p) => p.id === id)
  const leadTime = (id: string) => catalog.leadTimes.find((l) => l.id === id)
  const cheapest = byId('pla')
  const priciest = byId('iglidur')
  const economy = leadTime('economy')
  const express = leadTime('express')

  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>FDM materials</strong> are priced by weight and machine time. We
        estimate print weight like a slicer would: a solid{' '}
        {catalog.fdm.shellThicknessMm} mm shell over your part’s surface plus{' '}
        {Math.round(catalog.fdm.infillFraction * 100)}% infill of the interior,
        converted to grams with the material’s density. We charge the material’s
        per-kg rate ({cheapest?.label} {cheapest?.plnPerKg} zł/kg up to{' '}
        {priciest?.label} {priciest?.plnPerKg} zł/kg), then add machine time —
        walls print at {catalog.fdm.shellGramsPerPrintHour} g/h, infill at{' '}
        {catalog.fdm.infillGramsPerPrintHour} g/h — × the machine’s hourly rate.
      </p>
      <p>
        <strong>Quantity</strong> earns a per-unit discount, from 5% at 5 units
        up to 28% at 50. <strong>Lead time</strong> adjusts the price: Economy −
        {economy ? Math.round((1 - economy.mult) * 100) : 10}%, Standard base,
        Express +{express ? Math.round((express.mult - 1) * 100) : 30}%.
      </p>
      <p>
        Every part is billed at least {catalog.minPartPricePln} zł, and orders
        under {catalog.minOrderPln} zł are topped up to the{' '}
        {catalog.minOrderPln} zł minimum. Each order adds a flat{' '}
        {catalog.orderFeePln} zł fee. Shipping is {catalog.shippingFlatPln} zł
        flat, free above {catalog.freeShippingThresholdPln} zł. All prices
        include {Math.round(catalog.vatRate * 100)}% VAT (PL).
      </p>
    </div>
  )
}
