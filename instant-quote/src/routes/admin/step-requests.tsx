// STEP manual-quote queue (plan 07 Phase E): list, download the attached
// file, mark quoted / close. "Send custom quote" is a prefilled mailto at
// launch. EN-only (i18n-exempt).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { errorCode } from './-components/util'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export const Route = createFileRoute('/admin/step-requests')({
  component: StepQueue,
})

type StepStatus = components['schemas']['AdminStepRequestSummary']['status']
type StepSummary = components['schemas']['AdminStepRequestSummary']

const STATUS_OPTIONS: Array<StepStatus | 'all'> = [
  'all',
  'new',
  'quoted',
  'closed',
]

function StepQueue() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StepStatus | 'all'>('all')

  const { data, isPending, error } = useQuery({
    queryKey: ['admin', 'step-requests', { status }],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/step-requests', {
        params: { query: { ...(status !== 'all' && { status }) } },
      })
      if (!res.data) throw new ApiRequestError(res.error)
      return res.data
    },
  })

  const update = useMutation({
    mutationFn: async (vars: {
      requestId: string
      to: 'quoted' | 'closed'
    }) => {
      const res = await api.POST(
        '/api/v1/admin/step-requests/{requestId}/status',
        {
          params: { path: { requestId: vars.requestId } },
          body: { status: vars.to },
        },
      )
      if (res.error) throw new ApiRequestError(res.error)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'step-requests'],
      })
    },
    onError: (err) => toast.error(errorCode(err)),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-extrabold tracking-tight">STEP queue</h1>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StepStatus | 'all')}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt === 'all' ? 'All' : opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase">
          Loading…
        </p>
      ) : error ? (
        <p className="text-destructive font-mono text-xs">{errorCode(error)}</p>
      ) : data.requests.length === 0 ? (
        <p className="text-muted-foreground text-sm">Queue empty.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.requests.map((sr) => (
              <QueueRow
                key={sr.requestId}
                sr={sr}
                busy={update.isPending}
                onUpdate={(to) =>
                  update.mutate({ requestId: sr.requestId, to })
                }
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function QueueRow({
  sr,
  busy,
  onUpdate,
}: {
  sr: StepSummary
  busy: boolean
  onUpdate: (to: 'quoted' | 'closed') => void
}) {
  const mailto = `mailto:?subject=${encodeURIComponent(
    `Your STEP quote request ${sr.requestId} (${sr.fileName})`,
  )}`
  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-bold">
        {sr.requestId}
      </TableCell>
      <TableCell className="text-[13px]">
        {sr.fileName}
        {sr.fileId && (
          <a
            href={`/api/v1/admin/step-requests/${sr.requestId}/file`}
            download
            className="ml-2 font-mono text-[0.6rem] tracking-[0.14em] uppercase underline underline-offset-4"
          >
            Download
          </a>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {(sr.fileSizeBytes / 1024).toFixed(1)} KB
      </TableCell>
      <TableCell>
        <Badge variant={sr.status === 'new' ? 'default' : 'outline'}>
          {sr.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground font-mono text-[0.65rem] uppercase">
        {formatPlacedDate(sr.createdAt, 'en')}
      </TableCell>
      <TableCell className="text-right">
        <span className="flex justify-end gap-2">
          <a
            href={mailto}
            className="font-mono text-[0.6rem] tracking-[0.14em] uppercase underline underline-offset-4"
          >
            Quote via email
          </a>
          {sr.status === 'new' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onUpdate('quoted')}
            >
              Mark quoted
            </Button>
          )}
          {sr.status !== 'closed' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onUpdate('closed')}
            >
              Close
            </Button>
          )}
        </span>
      </TableCell>
    </TableRow>
  )
}
