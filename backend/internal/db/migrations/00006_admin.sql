-- Back-office admin (roadmap plan 07). Extends orders additively with the
-- tracking number the shipped transition requires, plus the two indexes the
-- orders board and customer lookup filter on.

-- +goose Up
ALTER TABLE orders ADD COLUMN tracking_number text;
CREATE INDEX orders_email ON orders (email);
CREATE INDEX orders_status ON orders (status);

-- +goose Down
DROP INDEX orders_status;
DROP INDEX orders_email;
ALTER TABLE orders DROP COLUMN tracking_number;
