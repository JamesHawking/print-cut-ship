import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { strings } from '@/lib/strings'
import { PRICING } from '@/lib/pricing-config'

export function HowWePriceDialog() {
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
        <div className="space-y-3 text-sm">
          <p>
            <strong>FDM materials</strong> are priced by weight and machine
            time. We estimate print weight like a slicer would: a solid{' '}
            {PRICING.fdm.shellThicknessMm} mm shell over your part’s surface
            plus {Math.round(PRICING.fdm.infillFraction * 100)}% infill of the
            interior, converted to grams with the material’s density. We charge
            the material’s per-kg rate (PLA {PRICING.processes.pla.plnPerKg}{' '}
            zł/kg up to Iglidur {PRICING.processes.iglidur.plnPerKg} zł/kg),
            then add machine time — walls print at{' '}
            {PRICING.fdm.shellGramsPerPrintHour} g/h, infill at{' '}
            {PRICING.fdm.infillGramsPerPrintHour} g/h — × the machine’s hourly
            rate.
          </p>
          <p>
            <strong>Quantity</strong> earns a per-unit discount, from 5% at 5
            units up to 28% at 50. <strong>Lead time</strong> adjusts the price:
            Economy −{Math.round((1 - PRICING.leadTimes.economy.mult) * 100)}%,
            Standard base, Express +
            {Math.round((PRICING.leadTimes.express.mult - 1) * 100)}%.
          </p>
          <p>
            Every part is billed at least {PRICING.minPartPricePln} zł, and
            orders under {PRICING.minOrderPln} zł are topped up to the{' '}
            {PRICING.minOrderPln} zł minimum. Each order adds a flat{' '}
            {PRICING.orderFeePln} zł fee. Shipping is {PRICING.shippingFlatPln}{' '}
            zł flat, free above {PRICING.freeShippingThresholdPln} zł. All
            prices include {Math.round(PRICING.vatRate * 100)}% VAT (PL).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
