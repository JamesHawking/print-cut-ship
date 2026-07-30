-- Per-part print options (design project 9deb1493, "Editor Options" turn 2):
-- nozzle, infill and filament colour become things a customer chooses, so the
-- shop has to receive them alongside the process and lead time it already
-- gets. Defaults match pricing.DefaultNozzleID / DefaultInfillID /
-- DefaultColorID, so rows written before this migration read back as the
-- configuration they were actually quoted at.

-- +goose Up
ALTER TABLE quote_parts
    ADD COLUMN nozzle text NOT NULL DEFAULT 'n04',
    ADD COLUMN infill text NOT NULL DEFAULT 'standard',
    ADD COLUMN color  text NOT NULL DEFAULT 'black';

ALTER TABLE order_items
    ADD COLUMN nozzle text NOT NULL DEFAULT 'n04',
    ADD COLUMN infill text NOT NULL DEFAULT 'standard',
    ADD COLUMN color  text NOT NULL DEFAULT 'black';

-- +goose Down
ALTER TABLE order_items
    DROP COLUMN nozzle,
    DROP COLUMN infill,
    DROP COLUMN color;

ALTER TABLE quote_parts
    DROP COLUMN nozzle,
    DROP COLUMN infill,
    DROP COLUMN color;
