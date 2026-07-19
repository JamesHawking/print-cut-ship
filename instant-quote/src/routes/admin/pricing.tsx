// Pricing config editor (plan 07 Phase C): typed form over the active
// snapshot, diff-vs-active preview, version history with load-into-form.
// Publishing swaps the engine live — no deploy. EN-only (i18n-exempt).

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { History, Rocket } from 'lucide-react'

import { errorCode } from './-components/util'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api/client'
import { ApiRequestError } from '@/lib/api/errors'
import { formatPlacedDate } from '@/lib/format'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin/pricing')({
  component: PricingEditor,
})

type PricingConfig = components['schemas']['PricingConfig']

type Diff = { path: string; from: unknown; to: unknown }

function diffConfigs(a: unknown, b: unknown, path: string, out: Diff[]) {
  if (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null
  ) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) {
      diffConfigs(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        path ? `${path}.${k}` : k,
        out,
      )
    }
    return
  }
  if (a !== b) out.push({ path, from: a, to: b })
}

// Number field with local string state so typing "0." isn't clobbered by the
// committed value round-tripping back into the input.
function Num({
  value,
  onCommit,
  className,
}: {
  value: number
  onCommit: (n: number) => void
  className?: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <Input
      className={className ?? 'h-8 w-24 font-mono text-xs'}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n)) onCommit(n)
      }}
    />
  )
}

function PricingEditor() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<PricingConfig | null>(null)
  const [label, setLabel] = useState('')

  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'pricing-config'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/pricing-config')
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  const active = data?.active
  useEffect(() => {
    if (active && draft === null) {
      setDraft(structuredClone(active.config))
      setLabel(`edit ${active.createdAt.slice(0, 10)}`)
    }
  }, [active, draft])

  const publish = useMutation({
    mutationFn: async (vars: { label: string; config: PricingConfig }) => {
      const res = await api.POST('/api/v1/admin/pricing-config', {
        body: { label: vars.label, config: vars.config },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success('Pricing config published — live for new quotes')
      setDraft(null)
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'pricing-config'],
      })
    },
    onError: (err) => toast.error(errorCode(err)),
  })

  const loadSnapshot = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.GET('/api/v1/admin/pricing-config/{id}', {
        params: { path: { id } },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    onSuccess: (snap) => {
      setDraft(structuredClone(snap.config))
      setLabel(`copy of ${snap.label}`)
      toast.success('Snapshot loaded into the form')
    },
    onError: (err) => toast.error(errorCode(err)),
  })

  if (isPending || !draft || !active) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <p className="text-destructive font-mono text-xs">{errorCode(error)}</p>
    )
  }

  const update = (fn: (c: PricingConfig) => void) =>
    setDraft((d) => {
      if (!d) return d
      const copy = structuredClone(d)
      fn(copy)
      return copy
    })

  const diffs: Diff[] = []
  diffConfigs(active.config, draft, '', diffs)

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-background sticky top-14 z-10 -mx-1 flex flex-wrap items-end justify-between gap-4 px-1 pt-1 pb-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Pricing config
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            Active: {active.label} · {formatPlacedDate(active.createdAt, 'en')}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Version label</Label>
            <Input
              id="label"
              className="w-56"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={
                  diffs.length === 0 || label.trim() === '' || publish.isPending
                }
              >
                <Rocket />
                Publish ({diffs.length}{' '}
                {diffs.length === 1 ? 'change' : 'changes'})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish pricing config?</AlertDialogTitle>
                <AlertDialogDescription>
                  Publishing swaps the pricing engine live — every new quote and
                  reprice uses "{label.trim()}" immediately. Active carts keep
                  their frozen snapshots.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    publish.mutate({ label: label.trim(), config: draft })
                  }
                >
                  Publish now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {diffs.length > 0 && (
        <Card className="border-highlight/60 gap-0 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-bold tracking-tight">
              Diff vs active
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {diffs.map((d) => (
                <li key={d.path}>
                  <span className="text-muted-foreground">{d.path}:</span>{' '}
                  <span className="text-destructive line-through">
                    {String(d.from)}
                  </span>{' '}
                  →{' '}
                  <span className="text-foreground font-bold">
                    {String(d.to)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">Processes</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Density g/cm³</TableHead>
                <TableHead>PLN/kg</TableHead>
                <TableHead>Factor</TableHead>
                <TableHead>PLN/h</TableHead>
                <TableHead>Build X×Y×Z</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.Processes.map((p, i) => (
                <TableRow key={p.ID}>
                  <TableCell className="font-mono text-xs font-bold">
                    {p.ID}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {p.Label}
                  </TableCell>
                  <TableCell>
                    <Num
                      value={p.DensityGCm3}
                      onCommit={(n) =>
                        update((c) => (c.Processes[i].DensityGCm3 = n))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Num
                      value={p.PlnPerKg}
                      onCommit={(n) =>
                        update((c) => (c.Processes[i].PlnPerKg = n))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Num
                      value={p.Factor}
                      onCommit={(n) =>
                        update((c) => (c.Processes[i].Factor = n))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Num
                      value={p.PlnPerHour}
                      onCommit={(n) =>
                        update((c) => (c.Processes[i].PlnPerHour = n))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <Num
                          key={axis}
                          className="h-8 w-16 font-mono text-xs"
                          value={p.Build[axis]}
                          onCommit={(n) =>
                            update((c) => (c.Processes[i].Build[axis] = n))
                          }
                        />
                      ))}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-tight">Lead times</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Multiplier</TableHead>
                  <TableHead>Business days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.LeadTimes.map((lt, i) => (
                  <TableRow key={lt.ID}>
                    <TableCell className="font-mono text-xs font-bold">
                      {lt.ID}
                    </TableCell>
                    <TableCell>
                      <Num
                        value={lt.Mult}
                        onCommit={(n) =>
                          update((c) => (c.LeadTimes[i].Mult = n))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Num
                        value={lt.BusinessDays}
                        onCommit={(n) =>
                          update(
                            (c) =>
                              (c.LeadTimes[i].BusinessDays = Math.round(n)),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-tight">
            Discount tiers
          </h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From quantity</TableHead>
                  <TableHead>Discount fraction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.DiscountTiers.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Num
                        value={t.Quantity}
                        onCommit={(n) =>
                          update((c) => (c.DiscountTiers[i].Quantity = n))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Num
                        value={t.Fraction}
                        onCommit={(n) =>
                          update((c) => (c.DiscountTiers[i].Fraction = n))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-tight">FDM model</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['InfillFraction', 'Infill fraction'],
                ['ShellThicknessMm', 'Shell thickness (mm)'],
                ['ShellGramsPerPrintHour', 'Shell g/h'],
                ['InfillGramsPerPrintHour', 'Infill g/h'],
              ] as const
            ).map(([key, lab]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label>{lab}</Label>
                <Num
                  className="h-8 font-mono text-xs"
                  value={draft.Fdm[key]}
                  onCommit={(n) => update((c) => (c.Fdm[key] = n))}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-tight">
            Fees & scalars
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['MinOrderPln', 'Min order (PLN)'],
                ['MinPartPricePln', 'Min part price (PLN)'],
                ['OrderFeePln', 'Order fee (PLN)'],
                ['ShippingFlatPln', 'Shipping flat (PLN)'],
                ['FreeShippingThresholdPln', 'Free shipping from (PLN)'],
                ['ExtraPlateFeePln', 'Extra plate fee (PLN)'],
                ['PlateGutterMm', 'Plate gutter (mm)'],
                ['MinBillableVolumeCm3', 'Min billable volume (cm³)'],
                ['MinFeatureMm', 'Min feature (mm)'],
                ['VatRate', 'VAT rate'],
                ['SameDayCutoffHour', 'Same-day cutoff hour'],
              ] as const
            ).map(([key, lab]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label>{lab}</Label>
                <Num
                  className="h-8 font-mono text-xs"
                  value={draft[key]}
                  onCommit={(n) => update((c) => (c[key] = n))}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">History</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.history ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-[13px] font-semibold">
                    {h.label}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
                    {formatPlacedDate(h.createdAt, 'en')}
                  </TableCell>
                  <TableCell>
                    {h.isActive ? (
                      <Badge>active</Badge>
                    ) : (
                      <Badge variant="outline">superseded</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadSnapshot.isPending}
                      onClick={() => loadSnapshot.mutate(h.id)}
                    >
                      <History />
                      Load into form
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
