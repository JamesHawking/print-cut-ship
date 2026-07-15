# Instant Quote — Go backend

Canonical backend for the instant-quote app (`../instant-quote` is
frontend-only). Owns pricing, ship dates, quote intake, and the MakerWorld
download proxy. All future API surface (auth, orders, payments, admin) lands
here — see `../Plans/DECISIONS.md`.

## Run

```sh
make dev                    # from the repo root: this API + the frontend together
go run ./cmd/api            # just the API, :8080 (PORT to override)
air                         # hot-reload alternative
```

Env:

- `PORT` — listen port, default `8080`
- `BAMBU_CLOUD_TOKEN` — required for `/api/v1/makerworld/fetch` (same token
  as the old `.env` in instant-quote; expires ~90 days)

The frontend dev server proxies `/api` here (Nitro routeRules in
`../instant-quote/vite.config.ts`, target overridable via `API_PROXY`).
In production, route the `/api` path prefix to this service at the reverse
proxy; the Nitro fallback proxy also works if `API_PROXY` is set.

## API

Spec-first: `api/openapi.yaml` is the contract.

```sh
make gen        # regenerate Go server/types AND the frontend TS client
make test       # go test ./...
```

Endpoints: `POST /api/v1/price`, `GET /api/v1/config`,
`GET /api/v1/ship-dates`, `POST /api/v1/quotes`, `POST /api/v1/step-quotes`,
`POST /api/v1/makerworld/fetch`, `GET /healthz`.

`quotes` and `step-quotes` are still honest stubs (log + generated ID — no
persistence yet; that's roadmap topic 1), but prices are recomputed
server-side and never trusted from the client.

## Pricing engine and golden fixtures

`internal/pricing` (+ `internal/leadtime`) is an exact port of the original
TypeScript engine — same arithmetic order, and `round2` replicates JS
`Math.round` half-up semantics (`math.Floor(n*100+0.5)/100`). Exactness is
enforced by `testdata/golden.json` fixtures generated from the TS
implementation before it was deleted (1,512 part-quote cases + order totals
+ packing + ship dates).

The fixtures are **frozen artifacts**: the generator
(`instant-quote/tests/golden/generate.ts`) was removed together with the TS
engine — recover both from git history at commit `e3d45ec`-era if fixtures
ever need regenerating. When pricing rules change intentionally, update the
Go engine and its unit tests; golden cases that the change invalidates must
be updated by hand (or the whole file re-derived from a trusted state).

Ship-date labels are canonical here ("Thu 16 Jul", "Sept" for September —
Chrome/V8 Intl parity; JS engines disagree with each other, so the labels
are deliberately not golden-fixtured).

## Deploy

`Dockerfile` builds a static binary on distroless; tzdata is embedded via
`time/tzdata` so Europe/Warsaw works in the minimal image. Health check:
`GET /healthz`.
