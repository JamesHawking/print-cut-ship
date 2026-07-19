-- name: InsertOrder :one
INSERT INTO orders (
    short_id, quote_id, user_id, email, status, gross_total_grosze, vat_grosze,
    pricing_config_id, pricing_snapshot, locale, country, company_name, nip,
    invoice_requested, shipping_address, billing_address, status_token
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
)
RETURNING id, short_id;

-- name: InsertOrderItem :exec
INSERT INTO order_items (
    order_id, file_id, file_name, hash, process, quantity, lead_time,
    unit_price_grosze, line_total_grosze, part_quote_snapshot
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
);

-- name: MarkQuoteOrdered :exec
UPDATE quotes SET status = 'ordered', updated_at = now() WHERE id = $1;

-- name: GetOrderByShortID :one
SELECT * FROM orders WHERE short_id = $1;

-- name: GetOrderByStatusToken :one
SELECT * FROM orders WHERE status_token = $1;

-- name: GetOrderByCheckoutSessionID :one
SELECT * FROM orders WHERE checkout_session_id = $1;

-- name: GetOrderByPaymentRef :one
SELECT * FROM orders WHERE payment_ref = $1;

-- name: GetOrderItemsByOrderID :many
SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at;

-- name: ListOrdersByEmailOrUser :many
-- Order history for the account page: orders placed under the session's user
-- id or (for guest checkouts) its email. Newest first; part_count/first_*
-- summarize the line items like ListQuotesByEmail did.
SELECT o.short_id, o.status, o.gross_total_grosze, o.created_at, o.status_token,
       (SELECT count(*) FROM order_items i WHERE i.order_id = o.id)::int AS part_count,
       (SELECT i.file_name FROM order_items i WHERE i.order_id = o.id
        ORDER BY i.created_at, i.id LIMIT 1) AS first_file_name,
       (SELECT i.lead_time FROM order_items i WHERE i.order_id = o.id
        ORDER BY i.created_at, i.id LIMIT 1) AS first_lead_time
FROM orders o
WHERE o.user_id = sqlc.arg(user_id)::uuid OR o.email = sqlc.arg(email)
ORDER BY o.created_at DESC
LIMIT 50;

-- name: CountStoredFilesByIDs :one
-- Order-creation gate: every part's file must be uploaded (storage_key set)
-- and not soft-deleted. The handler compares this count against the number of
-- distinct file ids on the quote's parts.
SELECT count(*) FROM files
WHERE id = ANY($1::uuid[]) AND storage_key IS NOT NULL AND deleted_at IS NULL;

-- name: SetOrderCheckoutSession :exec
UPDATE orders
SET checkout_session_id = $2,
    checkout_session_url = $3,
    checkout_session_expires_at = $4,
    updated_at = now()
WHERE id = $1;

-- name: InsertPaymentEvent :execrows
-- Idempotency spine: a redelivered provider event conflicts and inserts 0 rows,
-- which the pipeline treats as an already-processed no-op.
INSERT INTO payments (
    order_id, provider, provider_event_id, payment_ref, type, amount_grosze, status, raw
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
ON CONFLICT (provider_event_id) DO NOTHING;

-- name: MarkOrderPaid :execrows
-- Transition guarded in SQL so a racing duplicate event can never double-apply;
-- 0 rows means the order was not in draft (already processed or wrong state).
UPDATE orders SET status = 'paid', paid_at = now(), payment_ref = $2, updated_at = now()
WHERE id = $1 AND status = 'draft';

-- name: MarkOrderRefunded :execrows
UPDATE orders SET status = 'refunded', updated_at = now()
WHERE id = $1 AND status = 'paid';

-- name: ListInvoiceableOrders :many
-- Retry seam (api retry-invoices): paid orders the policy says must be invoiced
-- (B2B always, B2C on request) with no VAT invoice row yet. No-op until plan 18.
SELECT o.* FROM orders o
WHERE o.status = 'paid'
  AND (o.nip IS NOT NULL OR o.invoice_requested)
  AND NOT EXISTS (
      SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.kind = 'vat'
  )
ORDER BY o.paid_at;
