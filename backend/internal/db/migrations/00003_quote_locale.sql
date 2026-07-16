-- Quote locale (plan 08 phase D): the UI language at submit time, persisted
-- so downstream emails/invoices render in the customer's language (plan 06);
-- plan 05 seeds orders.locale from this column.

-- +goose Up
ALTER TABLE quotes ADD COLUMN locale text NOT NULL DEFAULT 'pl'; -- pl | en

-- +goose Down
ALTER TABLE quotes DROP COLUMN locale;
