-- name: InsertEmailLog :exec
INSERT INTO email_log (
    dedupe_key, to_addr, template, locale, status,
    provider_message_id, error, order_id, user_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
);

-- name: HasSentEmail :one
-- Dedupe check before sending: true when a prior send under this key already
-- succeeded (the partial unique index email_log_dedupe_sent backstops races).
SELECT EXISTS (
    SELECT 1 FROM email_log WHERE dedupe_key = $1 AND status = 'sent'
);
