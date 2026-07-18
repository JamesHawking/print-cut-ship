# MICRO_FACTORY

Instant quoting for on-demand 3D printing in the EU. A visitor drops a 3D file
and immediately gets a transparent, itemized price with a concrete ship date —
no account, no sales call. Poland-based production, PL + EN, PLN, shipping
across the EU.

This repository is the entire business: the product code, the plans that drive
it, and the market/product context behind both. It is worked on by humans and
by multiple AI agents — coding and non-coding alike.

## Repo map

| Path | What lives here | Start with |
| --- | --- | --- |
| `backend/` | Go API — canonical backend (chi, sqlc, OpenAPI-first) | `backend/README.md` |
| `instant-quote/` | TanStack Start + React 19 frontend (Bun) | `instant-quote/README.md` |
| `plans/engineering/` | Production-readiness roadmap: 16 topic plans + ROADMAP + DECISIONS | `plans/engineering/ROADMAP.md` |
| `plans/advisor/` | Audit-derived implementation plans with a status table | `plans/advisor/README.md` |
| `plans/seo/` | Executable SEO/content build prompts | `plans/seo/00_README.md` |
| `business/` | What the company is: product, positioning, brand | `business/README.md` |
| `research/` | Market and competitor research | `research/README.md` |
| `archive/` | Historical artifacts kept for provenance | — |

## If you are an agent

1. Read [`AGENTS.md`](AGENTS.md) — the operating manual (invariants, generated
   files, verification gates).
2. Pick the index for your task type from the table above.
3. Never rebuild shipped work — check a plan's `> **Status:**` banner before
   executing it (the truthfulness rule lives in `AGENTS.md`).

## Quickstart (code)

```sh
docker compose up -d   # Postgres + MinIO
make dev               # Go API :8080 + frontend :3000 (migrates + seeds)
make test              # both unit suites
```

## Where things stand

- Engineering status roll-up: top of `plans/engineering/ROADMAP.md`
- Advisor findings and plan status: `plans/advisor/README.md`

Status is never duplicated into this README — follow the links.
