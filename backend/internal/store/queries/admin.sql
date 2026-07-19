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

-- name: AdminListOrdersByEmail :many
-- Customer lookup: the board's enriched shape filtered to one email (guest
-- orders included — email is the join key). Uses the orders_email index.
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
WHERE o.email = $1
ORDER BY o.created_at DESC
LIMIT 200;

-- name: GetUserByEmail :one
SELECT id, email, role, created_at FROM users WHERE email = $1;

-- name: ListStepRequestsByEmail :many
SELECT * FROM step_requests WHERE email = $1 ORDER BY created_at DESC LIMIT 200;

-- name: AdminListFilesByEmail :many
-- Files linked to the email via any of the three attach points (quote parts,
-- order items, STEP requests), deduplicated.
SELECT DISTINCT f.id, f.file_name, f.kind, f.file_size_bytes,
       (f.storage_key IS NOT NULL)::boolean AS stored, f.created_at
FROM files f
WHERE f.deleted_at IS NULL
  AND (EXISTS (SELECT 1 FROM quote_parts qp JOIN quotes q ON q.id = qp.quote_id
               WHERE qp.file_id = f.id AND q.email = $1)
    OR EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
               WHERE oi.file_id = f.id AND o.email = $1)
    OR EXISTS (SELECT 1 FROM step_requests sr
               WHERE sr.file_id = f.id AND sr.email = $1))
ORDER BY f.created_at DESC;

-- Erase dry-run counts. Retained = the invoice-retention carve-out (plan 09):
-- the order has retention_until set OR any invoice row.
-- name: AdminCountUserByEmail :one
SELECT count(*)::int FROM users WHERE email = $1;

-- name: AdminCountSessionsByEmail :one
SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id
WHERE u.email = $1;

-- name: AdminCountQuotesByEmail :one
SELECT count(*)::int FROM quotes WHERE email = $1;

-- name: AdminCountQuotePartsByEmail :one
SELECT count(*)::int FROM quote_parts qp JOIN quotes q ON q.id = qp.quote_id
WHERE q.email = $1;

-- name: AdminCountOrdersByRetention :one
SELECT count(*)::int FROM orders o
WHERE o.email = $1
  AND (o.retention_until IS NOT NULL
       OR EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)) = sqlc.arg(retained)::boolean;

-- name: AdminCountOrderItemsByRetention :one
SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.email = $1
  AND (o.retention_until IS NOT NULL
       OR EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)) = sqlc.arg(retained)::boolean;

-- name: AdminCountPaymentsByRetention :one
SELECT count(*)::int FROM payments p JOIN orders o ON o.id = p.order_id
WHERE o.email = $1
  AND (o.retention_until IS NOT NULL
       OR EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)) = sqlc.arg(retained)::boolean;

-- name: AdminCountInvoicesByEmail :one
SELECT count(*)::int FROM invoices i JOIN orders o ON o.id = i.order_id
WHERE o.email = $1;

-- name: AdminCountStepRequestsByEmail :one
SELECT count(*)::int FROM step_requests WHERE email = $1;

-- name: AdminCountRetainedFilesByEmail :one
SELECT count(DISTINCT f.id)::int FROM files f
JOIN order_items oi ON oi.file_id = f.id
JOIN orders o ON o.id = oi.order_id
WHERE o.email = $1
  AND (o.retention_until IS NOT NULL
       OR EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id));

-- name: AdminCountDeletableFilesByEmail :one
-- Files the email touches that no retained order needs.
SELECT count(DISTINCT f.id)::int FROM files f
WHERE (EXISTS (SELECT 1 FROM quote_parts qp JOIN quotes q ON q.id = qp.quote_id
               WHERE qp.file_id = f.id AND q.email = $1)
    OR EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
               WHERE oi.file_id = f.id AND o.email = $1)
    OR EXISTS (SELECT 1 FROM step_requests sr
               WHERE sr.file_id = f.id AND sr.email = $1))
  AND NOT EXISTS (
       SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.file_id = f.id AND o.email = $1
         AND (o.retention_until IS NOT NULL
              OR EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)));

-- name: AdminListOpenOrders :many
-- Ops view input: orders being actively fulfilled (paid + in_production),
-- the enriched board shape. The Go side derives ship-by and filters due ones.
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
WHERE o.status IN ('paid', 'in_production')
ORDER BY o.created_at DESC;

-- name: AdminStatsByStatus :many
-- Board pills: every order status with its count.
SELECT o.status, count(*)::int AS count
FROM orders o
GROUP BY o.status;

-- name: AdminStatsDaily :many
-- KPI strip input: per-day order counts + gross on the Warsaw calendar,
-- covering today and the 14 lookback days (the Go side zero-fills).
SELECT to_char(o.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day,
       count(*)::int AS orders,
       coalesce(sum(o.gross_total_grosze), 0)::bigint AS gross_grosze
FROM orders o
WHERE o.created_at >= ((now() AT TIME ZONE 'Europe/Warsaw')::date - 14)::timestamptz
GROUP BY 1
ORDER BY 1;

-- name: AdminCountNewStepRequests :one
SELECT count(*)::int FROM step_requests WHERE status = 'new';
