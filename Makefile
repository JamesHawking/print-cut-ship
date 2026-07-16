# Local dev orchestration. `make dev` runs the Go API (:8080) and the
# frontend dev server (:3000, proxies /api to the Go service) together;
# Ctrl+C stops both. BAMBU_CLOUD_TOKEN is picked up from instant-quote/.env
# when present (MakerWorld import degrades gracefully without it).

.PHONY: dev dev-backend dev-frontend test db-up db-setup

# Local dev defaults to the docker-compose Postgres, so `make dev` needs no
# external config. Override by exporting DATABASE_URL (prod injects it).
DATABASE_URL ?= postgres://dev:dev@localhost:5432/instantquote
export DATABASE_URL

# Start (and wait for) the local Postgres from docker-compose.yml.
db-up:
	docker compose up -d --wait postgres

# One command to a working local DB: start Postgres, migrate, seed.
db-setup: db-up
	$(MAKE) -C backend migrate seed

dev: db-setup
	@trap 'kill 0' INT TERM EXIT; \
	( set -a; [ -f instant-quote/.env ] && . instant-quote/.env; set +a; \
	  cd backend && exec go run ./cmd/api ) & \
	( cd instant-quote && exec bun run dev ) & \
	wait

dev-backend: db-setup
	@set -a; [ -f instant-quote/.env ] && . instant-quote/.env; set +a; \
	cd backend && exec go run ./cmd/api

dev-frontend:
	cd instant-quote && bun run dev

# Both test suites.
test:
	cd backend && go test ./...
	cd instant-quote && bun test
