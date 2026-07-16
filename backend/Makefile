.PHONY: run test build gen gen-go gen-ts gen-sqlc gen-reference-prices migrate seed sweep migrate-new db-up dev-setup

# Local dev defaults to the docker-compose Postgres, so no external config is
# needed. Override by exporting DATABASE_URL (prod injects it via Coolify).
DATABASE_URL ?= postgres://dev:dev@localhost:5432/instantquote
export DATABASE_URL

# Start (and wait for) the local Postgres from the repo-root compose file.
db-up:
	cd .. && docker compose up -d --wait postgres

# One command to a working local DB: start Postgres, migrate, seed.
dev-setup: db-up migrate seed

run:
	go run ./cmd/api

test:
	go test ./...

build:
	go build ./...

# Regenerate server/type code from api/openapi.yaml (Go) and the TS client
# types consumed by instant-quote, plus the sqlc data-access layer.
gen: gen-go gen-ts gen-sqlc gen-reference-prices

gen-go:
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.4.1 \
		-generate types,chi-server -package httpapi \
		-o internal/httpapi/gen.go api/openapi.yaml

# Prettier pass keeps regeneration idempotent against the committed file
# (the repo's prettier config reformats generated output otherwise).
gen-ts:
	cd ../instant-quote && bunx openapi-typescript@7 ../backend/api/openapi.yaml \
		-o src/lib/api/schema.d.ts && bunx prettier --write src/lib/api/schema.d.ts

gen-sqlc:
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.29.0 generate

# Reference-part price tables for the material landing pages — computed by
# the engine, committed to the frontend (drift pinned by cmd/api tests).
gen-reference-prices:
	go run ./cmd/api reference-prices > ../instant-quote/src/content/reference-prices.json

# DB lifecycle (reads DATABASE_URL from the environment).
migrate:
	go run ./cmd/api migrate

seed:
	go run ./cmd/api seed

# File-retention sweep (Coolify scheduled task in prod, plan 03).
sweep:
	go run ./cmd/api sweep

# make migrate-new NAME=add_orders_columns
migrate-new:
	go run github.com/pressly/goose/v3/cmd/goose@v3.27.2 \
		-dir internal/db/migrations create $(NAME) sql
