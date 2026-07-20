# AGENTS.md — operating manual

This is a business-wide repository, not just a codebase: code, plans,
research, and business context live here and cross-reference each other. Start
at [`README.md`](README.md) for the map.

## Repo invariants

- **Two sibling projects, not a JS monorepo.** `backend/` (Go) is the
  canonical API; `instant-quote/` (TanStack Start + React 19 + Bun) is
  frontend-only. `make dev` at root runs both; the frontend dev server proxies
  `/api` to the Go service.
- **Bun for everything frontend** — `bun install`, `bun test`, `bunx`. Never
  npm/yarn/pnpm.
- **OpenAPI-first.** `backend/api/openapi.yaml` is the contract.
  `make -C backend gen` regenerates everything derived from it and from the
  SQL queries.
- **Never hand-edit generated files:**
  - `backend/internal/httpapi/gen.go`
  - all sqlc output in `backend/internal/store/` (`*.sql.go`, `models.go`,
    `db.go` — only `store.go` there is hand-written)
  - `instant-quote/src/lib/api/schema.d.ts`
  - `instant-quote/src/routeTree.gen.ts`
  - `instant-quote/src/content/reference-prices.json`
  - `backend/internal/email/templates/` (rendered by `bun run emails:build`
    from `instant-quote/src/emails/`)

  Change the source (`api/openapi.yaml`, `internal/store/queries/*.sql`, route
  files, the pricing engine) and regenerate.
- **Money is integer grosze** (`backend/internal/money`), gross
  (VAT-inclusive) PLN. Prices are always recomputed server-side from stored
  file bytes; the client is never trusted. Golden fixtures pin the pricing
  engine — change them only deliberately (see `backend/README.md`).
- **i18n:** `instant-quote/src/lib/i18n/pl.ts` is the source of truth, `en.ts`
  mirrors it. `bun run check-strings` (in `instant-quote/`) gates hardcoded
  strings. The backend returns machine codes + params; the frontend owns all
  human copy.
- **Plan status truthfulness.** The `> **Status:**` banner in each
  `plans/engineering/*.md` file is the source of truth for what is done. When
  you change a plan's state, update its banner AND mirror it in
  `plans/engineering/ROADMAP.md`'s roll-up line in the same commit. Read the
  banner before executing any plan — never rebuild shipped work.
- **Secrets never enter the repo.** `.env` is gitignored; `.env.example` files
  take placeholders only. When code starts reading a new env var, add it to
  the matching `.env.example` in the same change.

## Where to start, by task type

| Task | Start here |
| --- | --- |
| Ship a roadmap feature | `plans/engineering/ROADMAP.md` → the topic plan |
| Fix audit findings | `plans/advisor/README.md` (status table) |
| SEO / content work | `plans/seo/00_README.md` |
| Product, brand, positioning | `business/product.md` |
| Market / competitor questions | `research/README.md` |
| Any API change | `backend/api/openapi.yaml` first, then `make -C backend gen` |

## Verification gates

| Scope | Command |
| --- | --- |
| Backend | `cd backend && go build ./... && go test ./...` |
| Frontend | `cd instant-quote && bun test && bun run typecheck && bun run check-strings && bun run format:check` |
| Both unit suites | `make test` (repo root) |
| Codegen sync | `make -C backend gen`, then `git status` must show no changes |
| Email templates | `bun run emails:build` (in `instant-quote/`), then `git status` must show no changes |

Run the gates for every scope you touched before declaring done. Prettier
formats Markdown too — run `bun run format` if `format:check` flags a doc you
wrote.

## Working agreements

- Plan bodies are decision records: status banners change, bodies stay as
  history. Amend with dated notes rather than rewriting.
- New business domains (marketing, ops, finance, legal) get a top-level folder
  with a README when the first real artifact exists — don't create empty
  trees.
- Artifacts added to `research/` or `business/` get a row in that folder's
  README table in the same commit.
- Don't commit secrets, tokens, or customer data — ever.
