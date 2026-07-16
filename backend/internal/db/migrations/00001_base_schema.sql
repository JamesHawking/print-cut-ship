-- +goose Up
-- Base schema for the instant-quote backend (roadmap plan 01).
-- Plans 02/04/05/06/07 EXTEND these tables via later migrations; they never
-- redefine them. Money is integer grosze (gross, PLN). Public short IDs
-- (Q-/O-/STEP-) are minted in the handler; internal uuid PKs never leave the
-- server. gen_random_uuid() is built into Postgres 13+ core.

CREATE TABLE pricing_config_snapshots (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label      text NOT NULL,
    config     jsonb NOT NULL,
    is_active  boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- At most one active snapshot prices new quotes (plan 07 flips it).
CREATE UNIQUE INDEX pricing_config_one_active
    ON pricing_config_snapshots (is_active) WHERE is_active;

CREATE TABLE users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email      text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE files (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users (id),
    file_name       text NOT NULL,
    file_size_bytes bigint NOT NULL,
    kind            text NOT NULL,               -- 'mesh' | 'step'
    hash            text,                         -- content hash (dedupe)
    storage_key     text,                         -- S3 object key (null until plan 02)
    metrics         jsonb,                        -- server-recomputed MeshMetrics (plan 02)
    source          text NOT NULL DEFAULT 'upload', -- 'upload' | 'makerworld'
    source_ref      jsonb,
    expires_at      timestamptz,                  -- retention (plan 02 job)
    deleted_at      timestamptz,                  -- soft-delete
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quotes (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id               text NOT NULL UNIQUE,  -- Q-XXXXXXXX
    user_id                uuid REFERENCES users (id),
    email                  text,
    country                text,
    status                 text NOT NULL DEFAULT 'submitted', -- submitted | expired | ordered
    prices_ex_vat          boolean NOT NULL DEFAULT false,
    pricing_config_id      uuid NOT NULL REFERENCES pricing_config_snapshots (id),
    parts_subtotal_grosze  integer NOT NULL,
    min_order_topup_grosze integer NOT NULL,
    order_fee_grosze       integer NOT NULL,
    shipping_grosze        integer NOT NULL,
    net_total_grosze       integer NOT NULL,
    vat_grosze             integer NOT NULL,
    gross_total_grosze     integer NOT NULL,
    free_shipping          boolean NOT NULL,
    min_order_applied      boolean NOT NULL,
    expires_at             timestamptz,           -- 14-day validity (plan 14)
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quote_parts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id            uuid NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
    file_id             uuid REFERENCES files (id),
    file_name           text NOT NULL,
    hash                text NOT NULL,
    process             text NOT NULL,
    quantity            integer NOT NULL,
    lead_time           text NOT NULL,
    unit_price_grosze   integer NOT NULL,
    line_total_grosze   integer NOT NULL,
    billable_volume_cm3 double precision,
    piece_count         integer,                  -- multi-plate 3MF only
    plates              integer,
    breakdown           jsonb,                    -- BreakdownLine[]
    dfm_flags           jsonb,                    -- DfmFlag[]
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_parts_quote_id ON quote_parts (quote_id);

-- Skeleton only; plan 05 owns lifecycle/payment/invoice/shipping. No order is
-- created in plan 01 (checkout is plan 05).
CREATE TABLE orders (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id           text NOT NULL UNIQUE,      -- O-XXXXXXXX
    quote_id           uuid NOT NULL REFERENCES quotes (id),
    user_id            uuid REFERENCES users (id),
    email              text NOT NULL,
    status             text NOT NULL DEFAULT 'draft', -- plan 05 defines the state machine
    gross_total_grosze integer NOT NULL,
    vat_grosze         integer NOT NULL,
    pricing_config_id  uuid NOT NULL REFERENCES pricing_config_snapshots (id),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE step_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id        text NOT NULL UNIQUE,         -- STEP-XXXXXXXX
    email           text NOT NULL,
    file_name       text NOT NULL,
    file_size_bytes bigint NOT NULL,
    file_id         uuid REFERENCES files (id),
    status          text NOT NULL DEFAULT 'new',  -- new | quoted | closed
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE step_requests;
DROP TABLE orders;
DROP TABLE quote_parts;
DROP TABLE quotes;
DROP TABLE files;
DROP TABLE users;
DROP TABLE pricing_config_snapshots;
