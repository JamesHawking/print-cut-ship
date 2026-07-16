-- name: InsertQuote :one
INSERT INTO quotes (
    short_id, user_id, email, country, prices_ex_vat, pricing_config_id,
    parts_subtotal_grosze, min_order_topup_grosze, order_fee_grosze,
    shipping_grosze, net_total_grosze, vat_grosze, gross_total_grosze,
    free_shipping, min_order_applied
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
)
RETURNING id, short_id;

-- name: InsertQuotePart :exec
INSERT INTO quote_parts (
    quote_id, file_id, file_name, hash, process, quantity, lead_time,
    unit_price_grosze, line_total_grosze, billable_volume_cm3,
    piece_count, plates, breakdown, dfm_flags
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
);

-- name: GetQuoteByShortID :one
SELECT * FROM quotes WHERE short_id = $1;

-- name: ListQuotesByEmail :many
-- Order history for the prototype /orders page: every persisted quote is an
-- order request. Newest first; part_count/first_* summarize the line items.
SELECT q.short_id, q.status, q.gross_total_grosze, q.created_at,
       (SELECT count(*) FROM quote_parts p WHERE p.quote_id = q.id)::int AS part_count,
       (SELECT p.file_name FROM quote_parts p WHERE p.quote_id = q.id
        ORDER BY p.created_at, p.id LIMIT 1) AS first_file_name,
       (SELECT p.lead_time FROM quote_parts p WHERE p.quote_id = q.id
        ORDER BY p.created_at, p.id LIMIT 1) AS first_lead_time
FROM quotes q
WHERE q.email = $1
ORDER BY q.created_at DESC
LIMIT 50;

-- name: GetQuotePartsByQuoteID :many
SELECT * FROM quote_parts WHERE quote_id = $1 ORDER BY created_at;
