-- name: GetActivePricingConfig :one
SELECT id, label, config, created_at
FROM pricing_config_snapshots
WHERE is_active
LIMIT 1;

-- name: InsertPricingConfigSnapshot :one
INSERT INTO pricing_config_snapshots (label, config, is_active)
VALUES ($1, $2, $3)
RETURNING id;

-- name: DeactivatePricingConfigs :exec
UPDATE pricing_config_snapshots SET is_active = false WHERE is_active;

-- name: ListPricingConfigSnapshots :many
-- Version history for the admin editor, newest first (bounded — one row per
-- published edit).
SELECT id, label, is_active, created_at
FROM pricing_config_snapshots
ORDER BY created_at DESC
LIMIT 100;

-- name: GetPricingConfigSnapshotByID :one
SELECT id, label, config, is_active, created_at
FROM pricing_config_snapshots
WHERE id = $1;
