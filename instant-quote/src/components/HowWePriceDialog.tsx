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
            <strong>FDM materials</strong> are priced by weight and machine time.
            We convert your part’s volume to grams using the material’s density at{' '}
            {Math.round(PRICING.fdm.infillFraction * 100)}% infill, charge the
            material’s per-kg rate (PLA {PRICING.processes.pla.plnPerKg} zł/kg up to
            Iglidur {PRICING.processes.iglidur.plnPerKg} zł/kg), then add machine
            time at {PRICING.fdm.gramsPerPrintHour} g/h × the machine’s hourly rate.
          </p>
          <p>
            <strong>Quantity</strong> earns a per-unit discount, from 5% at 5 units
            up to 28% at 50. <strong>Lead time</strong> adjusts the price: Economy
            −{Math.round((1 - PRICING.leadTimes.economy.mult) * 100)}%, Standard
            base, Express +{Math.round((PRICING.leadTimes.express.mult - 1) * 100)}%.
          </p>
          <p>
            Every part is billed at least {PRICING.minPartPricePln} zł, and orders
            under {PRICING.minOrderPln} zł are topped up to the {PRICING.minOrderPln}{' '}
            zł minimum. Shipping is {PRICING.shippingFlatPln} zł flat, free above{' '}
            {PRICING.freeShippingThresholdPln} zł. VAT is{' '}
            {Math.round(PRICING.vatRate * 100)}% (PL) and shown separately.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
