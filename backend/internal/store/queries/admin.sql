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
