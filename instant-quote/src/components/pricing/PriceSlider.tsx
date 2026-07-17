import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type ProcessId } from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import { formatInt, formatPln } from '@/lib/format'
import { useLocale, useStrings } from '@/lib/i18n'
import { PRICING_CATALOG } from '@/content/pricing/data'

// Mirrors cubeMetrics() in backend/cmd/api/referenceprices.go — keep in sync.
function cubeMetrics(volumeCm3: number) {
  const sideCm = Math.cbrt(volumeCm3)
  const sideMm = sideCm * 10
  return {
    volumeCm3,
    surfaceAreaCm2: 6 * sideCm * sideCm,
    bboxMm: { x: sideMm, y: sideMm, z: sideMm },
    usedHullFallback: false,
  }
}

const DEBOUNCE_MS = 250
const DEFAULT_VOLUME = 25
const MAX_PARTS_PER_REQUEST = 5

/**
 * The page's hook: volume in, live per-material unit prices out — priced by
 * the same engine as the quote form (the pricing page's one deliberate
 * client-side API consumer; the prerendered HTML ships skeletons).
 */
export function PriceSlider() {
  const strings = useStrings()
  const locale = useLocale()
  const s = strings.pricingPage
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [debouncedVolume, setDebouncedVolume] = useState(DEFAULT_VOLUME)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedVolume(volume), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [volume])

  const materials = PRICING_CATALOG.materials
  const prices = useQuery({
    queryKey: ['slider-price', debouncedVolume],
    queryFn: async () => {
      const metrics = cubeMetrics(debouncedVolume)
      const chunks: Array<typeof materials> = []
      for (let i = 0; i < materials.length; i += MAX_PARTS_PER_REQUEST) {
        chunks.push(materials.slice(i, i + MAX_PARTS_PER_REQUEST))
      }
      const responses = await Promise.all(
        chunks.map((chunk) =>
          api.POST('/api/v1/price', {
            body: {
              parts: chunk.map((m) => ({
                metrics,
                process: m.id as ProcessId,
                quantity: 1,
                leadTime: 'standard' as const,
              })),
            },
          }),
        ),
      )
      const byMaterial: Record<string, number> = {}
      responses.forEach((res, chunkIndex) => {
        if (!res.data) throw new ApiRequestError(res.error)
        res.data.parts.forEach((part, i) => {
          byMaterial[chunks[chunkIndex][i].id] = part.unitPricePln
        })
      })
      return byMaterial
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })

  // Compact strip (design 2b): label, slider and per-material readouts on
  // one line at desktop; readouts wrap below on narrow screens. The parent
  // section provides the bg-card band.
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <label
          htmlFor="volume-slider"
          className="font-mono text-[0.7rem] font-bold tracking-[0.14em] whitespace-nowrap uppercase"
        >
          {s.sliderLabel(formatInt(volume, locale))}
        </label>
        <Slider
          id="volume-slider"
          className="min-w-[180px] flex-1 basis-48"
          min={1}
          max={200}
          step={1}
          value={[volume]}
          onValueChange={([v]) => setVolume(v)}
        />
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {materials.map((material) => (
            <div
              key={material.id}
              className="flex items-baseline gap-1.5 whitespace-nowrap"
            >
              <dt className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.1em] uppercase">
                {material.label}
              </dt>
              <dd
                aria-live="polite"
                className="font-mono text-[13px] font-bold tabular-nums"
              >
                {prices.data ? (
                  formatPln(prices.data[material.id], locale)
                ) : (
                  <Skeleton className="h-4 w-14" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-muted-foreground mt-2.5 font-mono text-[0.6rem] tracking-[0.14em] uppercase">
        {s.sliderNote}
      </p>
    </div>
  )
}
