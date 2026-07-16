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

  return (
    <div className="bg-card rounded-lg border p-6 shadow-xl shadow-black/[0.06] sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <label
          htmlFor="volume-slider"
          className="font-mono text-[0.7rem] font-bold tracking-[0.16em] uppercase"
        >
          {s.sliderLabel(formatInt(volume, locale))}
        </label>
        <span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.14em] uppercase">
          {s.sliderNote}
        </span>
      </div>
      <Slider
        id="volume-slider"
        className="mt-5"
        min={1}
        max={200}
        step={1}
        value={[volume]}
        onValueChange={([v]) => setVolume(v)}
      />
      <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {materials.map((material) => (
          <div key={material.id}>
            <dt className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.14em] uppercase">
              {material.label}
            </dt>
            <dd
              aria-live="polite"
              className="mt-1 font-mono text-lg font-bold tracking-tight whitespace-nowrap tabular-nums"
            >
              {prices.data ? (
                formatPln(prices.data[material.id], locale)
              ) : (
                <Skeleton className="h-6 w-20" />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
