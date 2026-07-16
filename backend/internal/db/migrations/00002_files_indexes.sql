-- +goose Up
-- Indexes for plan 02's file storage. The files table itself was provisioned
-- in 00001; this only adds lookup paths for dedup and the retention sweep.
CREATE INDEX files_hash ON files (hash) WHERE deleted_at IS NULL;
CREATE INDEX files_sweep ON files (created_at) WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX files_sweep;
DROP INDEX files_hash;
