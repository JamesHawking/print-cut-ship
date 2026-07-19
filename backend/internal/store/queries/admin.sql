-- name: AdminListOrders :many
-- Orders board: every order, newest first, optionally filtered by status.
-- lead_times feeds the Go-side ship-by derivation (lead-time engine with
-- paid_at as anchor); dfm_codes flags orders carrying a warn/block flag or
-- plan 02's manual_verify code (code-agnostic — the severity predicate alone
-- flags today's DFM codes).
SELECT o.short_id, o.email, o.status, o.gross_total_grosze, o.created_at,
       o.paid_at, o.tracking_number,
       (SELECT count(*) FROM order_items i WHERE i.order_id = o.id)::int AS part_count,
       (SELECT coalesce(array_agg(DISTINCT i.lead_time), '{}'::text[])
          FROM order_items i WHERE i.order_id = o.id)::text[] AS lead_times,
       (SELECT coalesce(array_agg(DISTINCT f ->> 'code'), '{}'::text[])
          FROM order_items i,
               jsonb_array_elements(i.part_quote_snapshot -> 'dfmFlags') f
          WHERE i.order_id = o.id
            AND ((f ->> 'severity') IN ('warn', 'block')
                 OR (f ->> 'code') = 'manual_verify'))::text[] AS dfm_codes
FROM orders o
WHERE (sqlc.narg(status)::text IS NULL OR o.status = sqlc.narg(status)::text)
ORDER BY o.created_at DESC
LIMIT sqlc.arg(row_limit) OFFSET sqlc.arg(row_offset);

-- name: AdminCountOrders :one
SELECT count(*)::int FROM orders o
WHERE (sqlc.narg(status)::text IS NULL OR o.status = sqlc.narg(status)::text);

-- name: ListPaymentsByOrderID :many
SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at;

-- name: ListInvoicesByOrderID :many
SELECT * FROM invoices WHERE order_id = $1 ORDER BY created_at;

-- name: MarkOrderInProduction :execrows
-- SQL-guarded like MarkOrderPaid: 0 rows means a race already moved the order.
UPDATE orders SET status = 'in_production', updated_at = now()
WHERE id = $1 AND status = 'paid';

-- name: MarkOrderShipped :execrows
UPDATE orders SET status = 'shipped', tracking_number = $2, updated_at = now()
WHERE id = $1 AND status = 'in_production';

-- name: MarkOrderDelivered :execrows
UPDATE orders SET status = 'delivered', updated_at = now()
WHERE id = $1 AND status = 'shipped';

-- name: MarkOrderCancelled :execrows
-- Cancel is allowed from every non-terminal state (internal/orders/status.go).
UPDATE orders SET status = 'cancelled', updated_at = now()
WHERE id = $1 AND status IN ('draft', 'paid', 'in_production', 'shipped');

-- name: GetOrderFileForDownload :one
-- The admin download gate: the file must be attached to THIS order (and not
-- soft-deleted) — a foreign file id is a 404, never a leak.
SELECT f.id, f.file_name, f.file_size_bytes, f.kind, f.storage_key
FROM files f
JOIN order_items i ON i.file_id = f.id
JOIN orders o ON o.id = i.order_id
WHERE o.short_id = $1 AND f.id = $2 AND f.deleted_at IS NULL;
