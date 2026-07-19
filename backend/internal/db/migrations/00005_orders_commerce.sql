-- Orders & checkout (roadmap plan 05, amended 2026-07-19: Stripe-shaped
-- provider port with a stub provider interim; Stripe + Fakturownia client
-- deferred to plan 18). Extends plan 01's orders skeleton additively — never
-- redefines. Money stays integer grosze (gross, PLN).

-- +goose Up
ALTER TABLE orders
    ADD COLUMN pricing_snapshot jsonb NOT NULL,      -- full OrderTotals frozen at order time
    ADD COLUMN locale text NOT NULL DEFAULT 'pl',    -- seeded from quotes.locale
    ADD COLUMN country text NOT NULL,                -- EU country enum value
    ADD COLUMN company_name text,                    -- nullable = B2C
    ADD COLUMN nip text,                             -- presence ⇒ B2B ⇒ always invoice
    ADD COLUMN invoice_requested boolean NOT NULL DEFAULT false,
    ADD COLUMN shipping_address jsonb NOT NULL,
    ADD COLUMN billing_address jsonb,                -- null ⇒ bill to shipping address
    ADD COLUMN status_token text NOT NULL UNIQUE,    -- bearer capability for the public status page
    ADD COLUMN checkout_session_id text,             -- provider checkout session
    ADD COLUMN checkout_session_url text,
    ADD COLUMN checkout_session_expires_at timestamptz,
    ADD COLUMN payment_ref text,                     -- provider's payment object id (Stripe PI in plan 18)
    ADD COLUMN retention_until date,                 -- set on invoice issue (plan 18); blocks GDPR erasure (plan 09)
    ADD COLUMN paid_at timestamptz;

COMMENT ON COLUMN orders.status IS
    'draft | paid | in_production | shipped | delivered | cancelled | refunded — internal/orders/status.go owns the transitions';

-- Snapshotted from quote_parts at order time: an order is immutable against
-- later re-pricing of its parent quote or config row.
CREATE TABLE order_items (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    file_id              uuid REFERENCES files (id),
    file_name            text NOT NULL,
    hash                 text NOT NULL,
    process              text NOT NULL,
    quantity             integer NOT NULL,
    lead_time            text NOT NULL,
    unit_price_grosze    integer NOT NULL,
    line_total_grosze    integer NOT NULL,
    part_quote_snapshot  jsonb NOT NULL,            -- full PartQuote (breakdown, dfmFlags, plates), copied
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_id ON order_items (order_id);

-- Provider payment-event ledger. provider_event_id is the idempotency spine:
-- the PSP will redeliver events, the unique constraint makes redelivery a no-op.
CREATE TABLE payments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          uuid NOT NULL REFERENCES orders (id),
    provider          text NOT NULL,                -- 'stub' | 'stripe' (plan 18)
    provider_event_id text NOT NULL UNIQUE,
    payment_ref       text,
    type              text NOT NULL,                -- 'payment' | 'refund'
    amount_grosze     integer NOT NULL,
    status            text NOT NULL,                -- 'succeeded' | 'pending' | 'failed'
    raw               jsonb,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_id ON payments (order_id);

-- Seam only until plan 18 (Fakturownia client): rows appear once real invoices
-- issue. retention_until mirrors orders.retention_until for the plan 09 carve-out.
CREATE TABLE invoices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        uuid NOT NULL REFERENCES orders (id),
    provider_id     text,                           -- Fakturownia invoice id (plan 18)
    number          text,
    pdf_url         text,
    pdf_storage_key text,                           -- MinIO mirror (plan 18)
    kind            text NOT NULL,                  -- 'vat' | 'proforma' | 'correction'
    issued_at       timestamptz,
    retention_until date,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_order_id ON invoices (order_id);

-- +goose Down
DROP TABLE invoices;
DROP TABLE payments;
DROP TABLE order_items;
ALTER TABLE orders
    DROP COLUMN pricing_snapshot,
    DROP COLUMN locale,
    DROP COLUMN country,
    DROP COLUMN company_name,
    DROP COLUMN nip,
    DROP COLUMN invoice_requested,
    DROP COLUMN shipping_address,
    DROP COLUMN billing_address,
    DROP COLUMN status_token,
    DROP COLUMN checkout_session_id,
    DROP COLUMN checkout_session_url,
    DROP COLUMN checkout_session_expires_at,
    DROP COLUMN payment_ref,
    DROP COLUMN retention_until,
    DROP COLUMN paid_at;
