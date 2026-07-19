// Customer lookup + GDPR tools (plan 07 Phase D): email search → trail
// sections, export JSON as a blob download, erase dry-run report. There is
// deliberately no destructive control. EN-only (i18n-exempt).

import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { STATUS_VARIANT, errorCode } from './-components/util'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatPlacedDate, formatPln } from '@/lib/format'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin/customers')({
  component: Customers,
})

type Lookup = components['schemas']['AdminCustomerLookup']
type EraseReport = components['schemas']['AdminEraseReport']

function Customers() {
  const [email, setEmail] = useState('')
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [erase, setErase] = useState<EraseReport | null>(null)

  const search = useMutation({
    mutationFn: async (q: string) => {
      const res = await api.GET('/api/v1/admin/customers', {
        params: { query: { email: q } },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setLookup(data)
      setErase(null)
    },
    onError: (err) => toast.error(errorCode(err)),
  })

  const exportJson = useMutation({
    mutationFn: async (q: string) => {
      const res = await api.POST('/api/v1/admin/customers/export', {
        body: { email: q },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    onSuccess: (data, q) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-${q}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    },
    onError: (err) => toast.error(errorCode(err)),
  })

  const eraseDryRun = useMutation({
    mutationFn: async (q: string) => {
      const res = await api.POST('/api/v1/admin/customers/erase', {
        body: { email: q, dryRun: true },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
    onSuccess: (data) => setErase(data),
    onError: (err) => toast.error(errorCode(err)),
  })

  const q = email.trim()
  const busy = search.isPending || exportJson.isPending || eraseDryRun.isPending

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-extrabold tracking-tight">Customers</h1>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (q) search.mutate(q)
        }}
      >
        <Input
          className="w-72"
          type="email"
          placeholder="customer@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={busy || q === ''}>
          Look up
        </Button>
        {lookup && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => exportJson.mutate(lookup.email)}
            >
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => eraseDryRun.mutate(lookup.email)}
            >
              Erase (dry run)
            </Button>
          </>
        )}
      </form>

      {lookup && <Trail lookup={lookup} />}
      {erase && <EraseReportView report={erase} />}
    </div>
  )
}

function Trail({ lookup }: { lookup: Lookup }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        {lookup.email} ·{' '}
        {lookup.user
          ? `registered ${formatPlacedDate(lookup.user.createdAt, 'en')} (${lookup.user.role})`
          : 'guest (no account)'}
      </p>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">
          Orders ({lookup.orders.length})
        </h2>
        {lookup.orders.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lookup.orders.map((o) => (
                <TableRow key={o.orderId}>
                  <TableCell className="font-mono text-xs font-bold">
                    <Link
                      to="/admin/orders/$shortId"
                      params={{ shortId: o.orderId }}
                      className="underline underline-offset-4"
                    >
                      {o.orderId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatPln(o.grossTotalPln, 'en')}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
                    {formatPlacedDate(o.createdAt, 'en')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">
          Quotes ({lookup.quotes.length})
        </h2>
        {lookup.quotes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>First file</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lookup.quotes.map((q) => (
                <TableRow key={q.quoteId}>
                  <TableCell className="font-mono text-xs font-bold">
                    {q.quoteId}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {q.status}
                  </TableCell>
                  <TableCell className="text-xs">{q.fileName ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatPln(q.grossTotalPln, 'en')}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
                    {formatPlacedDate(q.createdAt, 'en')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">
          STEP requests ({lookup.stepRequests.length})
        </h2>
        {lookup.stepRequests.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lookup.stepRequests.map((sr) => (
                <TableRow key={sr.requestId}>
                  <TableCell className="font-mono text-xs font-bold">
                    {sr.requestId}
                  </TableCell>
                  <TableCell className="text-xs">{sr.fileName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {sr.status}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
                    {formatPlacedDate(sr.createdAt, 'en')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-tight">
          Files ({lookup.files.length})
        </h2>
        {lookup.files.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Stored</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lookup.files.map((f) => (
                <TableRow key={f.fileId}>
                  <TableCell className="text-xs">{f.fileName}</TableCell>
                  <TableCell className="font-mono text-xs">{f.kind}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {(f.sizeBytes / 1024).toFixed(1)} KB
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {f.stored ? 'yes' : 'no'}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
                    {formatPlacedDate(f.createdAt, 'en')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

function EraseReportView({ report }: { report: EraseReport }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-bold tracking-tight">
        Erase dry run — {report.email}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-muted-foreground mb-2 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
            Would delete
          </h3>
          <Table>
            <TableBody>
              {report.wouldDelete.map((e) => (
                <TableRow key={e.table}>
                  <TableCell className="font-mono text-xs">{e.table}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {e.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h3 className="text-muted-foreground mb-2 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
            Retained
          </h3>
          {report.retained.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing retained.</p>
          ) : (
            <Table>
              <TableBody>
                {report.retained.map((e) => (
                  <TableRow key={e.table}>
                    <TableCell className="font-mono text-xs">
                      {e.table}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {e.count}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {e.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
      <p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.14em] uppercase">
        Dry run only — no data was deleted. Real erasure lands with plan 09.
      </p>
    </section>
  )
}
