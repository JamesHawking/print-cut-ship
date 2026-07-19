// Shared orders table (admin overhaul): full variant for the /admin/orders
// board, compact variant for the dashboard's recent-orders card. Rows click
// through to the order detail. EN-only (i18n-exempt directory).

import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Inbox, Truck } from 'lucide-react'

import { StatusPill } from './StatusPill'
import { formatShipBy } from './util'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatPlacedDate, formatPln } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { components } from '@/lib/api/schema'

type AdminOrderSummary = components['schemas']['AdminOrderSummary']

const HEAD_CLASS = 'font-mono text-[0.6rem] tracking-[0.14em] uppercase'

export function OrdersTable({
  orders,
  compact = false,
}: {
  orders: Array<AdminOrderSummary>
  compact?: boolean
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD_CLASS}>Order</TableHead>
            <TableHead className={HEAD_CLASS}>Email</TableHead>
            <TableHead className={HEAD_CLASS}>Status</TableHead>
            <TableHead className={cn(HEAD_CLASS, 'text-right')}>
              Gross
            </TableHead>
            <TableHead className={HEAD_CLASS}>Placed</TableHead>
            {!compact && (
              <>
                <TableHead className={HEAD_CLASS}>Ship by</TableHead>
                <TableHead className={HEAD_CLASS}>DFM</TableHead>
                <TableHead className={HEAD_CLASS}>Tracking</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <OrderRow key={o.orderId} order={o} compact={compact} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function OrderRow({
  order: o,
  compact,
}: {
  order: AdminOrderSummary
  compact: boolean
}) {
  const navigate = useNavigate()
  const open = () =>
    void navigate({
      to: '/admin/orders/$shortId',
      params: { shortId: o.orderId },
    })

  return (
    <TableRow
      className="cursor-pointer"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open()
      }}
    >
      <TableCell className="py-2 font-mono text-xs font-bold tabular-nums">
        <Link
          to="/admin/orders/$shortId"
          params={{ shortId: o.orderId }}
          className="underline underline-offset-4"
          onClick={(e) => e.stopPropagation()}
        >
          {o.orderId}
        </Link>
      </TableCell>
      <TableCell className="max-w-52 truncate py-2 text-[13px]">
        {o.email}
      </TableCell>
      <TableCell className="py-2">
        <StatusPill status={o.status} />
      </TableCell>
      <TableCell className="py-2 text-right font-mono text-xs tabular-nums">
        {formatPln(o.grossTotalPln, 'en')}
      </TableCell>
      <TableCell className="text-muted-foreground py-2 font-mono text-[0.65rem] uppercase">
        {formatPlacedDate(o.createdAt, 'en')}
      </TableCell>
      {!compact && (
        <>
          <TableCell className="py-2">
            <ShipByCell shipBy={o.shipBy} overdue={o.overdue} />
          </TableCell>
          <TableCell className="py-2">
            {o.dfmFlagged && o.dfmCodes ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline">
                    <AlertTriangle className="text-highlight" />
                    {o.dfmCodes.length}{' '}
                    {o.dfmCodes.length === 1 ? 'flag' : 'flags'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{o.dfmCodes.join(', ')}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell className="py-2 font-mono text-xs">
            {o.trackingNumber ? (
              <span className="inline-flex items-center gap-1.5">
                <Truck className="text-muted-foreground size-3.5" />
                {o.trackingNumber}
              </span>
            ) : (
              '—'
            )}
          </TableCell>
        </>
      )}
    </TableRow>
  )
}

export function ShipByCell({
  shipBy,
  overdue,
}: {
  shipBy: string | null | undefined
  overdue: boolean | undefined
}) {
  const label = formatShipBy(shipBy, overdue)
  if (!shipBy) return <span className="text-muted-foreground">—</span>
  const text = (
    <span
      className={cn(
        'font-mono text-[0.65rem] uppercase',
        overdue ? 'text-destructive font-bold' : 'text-muted-foreground',
      )}
    >
      {overdue && <AlertTriangle className="mr-1 inline size-3" />}
      {label}
    </span>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>{text}</TooltipTrigger>
      <TooltipContent>Ship by {shipBy}</TooltipContent>
    </Tooltip>
  )
}

export function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12">
      <Inbox className="text-muted-foreground size-6" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}
