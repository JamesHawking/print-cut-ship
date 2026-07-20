-- Transactional-email audit log (roadmap plan 06). One row per send attempt;
-- dedupe_key makes webhook-replay double-sends impossible. Deliberate
-- deviation from the plan doc's sketch: no plain UNIQUE(dedupe_key) — the
-- partial unique index below covers only status='sent', so a failed send can
-- be retried under the same key while a double success stays impossible
-- (race-safe backstop for the pre-send HasSentEmail check).

-- +goose Up
CREATE TABLE email_log (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key          text,                       -- nullable: login codes don't dedupe
    to_addr             text NOT NULL,
    template            text NOT NULL,
    locale              text NOT NULL,
    status              text NOT NULL,              -- 'sent' | 'failed'
    provider_message_id text,
    error               text,
    order_id            uuid REFERENCES orders (id), -- nullable: auth mail predates orders
    user_id             uuid REFERENCES users (id),  -- nullable: STEP requests have neither
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_log_dedupe_sent ON email_log (dedupe_key)
    WHERE status = 'sent' AND dedupe_key IS NOT NULL;
CREATE INDEX email_log_to_addr ON email_log (to_addr);   -- support lookup
CREATE INDEX email_log_order_id ON email_log (order_id);

-- +goose Down
DROP TABLE email_log;
