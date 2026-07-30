# deploy/ — solo-operator deployment (sidekick-agent)

Push-to-deploy rails for MICRO_FACTORY, co-tenant on the existing
`sidekick-agent` Hetzner box (Tailscale-only SSH; public surface is 80/443
via the existing coolify-proxy Traefik). Design record:
`plans/engineering/03-deploy-ci.md` §7 amendment.

**The flow:** `git push` from anywhere on the tailnet → bare repo on the
server → `post-receive` hook checks out the pushed SHA and runs `ship`,
streaming into your push output. The welded gate runs before anything
mutates: `go test ./...` in `backend/` (1,512-case pricing goldens
included), plus `bun run typecheck` for web targets (operator decision
2026-07-30). Backend ≈ 2–3 min, with frontend ≈ 6–9 min on this shared box.

```
Internet ──80/443──> coolify-proxy (Traefik, existing)
  /api, /healthz ──> host:8090  iq-api.service   (Go binary)
  everything else ─> host:3010  iq-web.service   (node .output/server/index.mjs)
  s3 host ─────────> MinIO :9002 (presigned browser uploads)
Coolify (demoted): Postgres 16 @127.0.0.1:5433 (app + app_dev) · MinIO (9002/9003)
/srv/iq: git/app.git · app/src (hook checkout — never hand-edit) ·
         releases/{api,web}-<sha> · current/ symlinks · env/ · dev/ · log/
```

## One-time bring-up (Phase B)

`[U]` = needs you (secrets, UI clicks). Verify each step before the next.

1. `[U]` Mac remotes — origin gets **both** push URLs (order = push order):

   ```sh
   git remote set-url --add --push origin git@github.com:JamesHawking/print-cut-ship.git
   git remote set-url --add --push origin iq@sidekick-agent:/srv/iq/git/app.git
   git remote -v   # fetch: GitHub · push: GitHub + server
   ```

2. Bootstrap the server (idempotent; safe to re-run any time):

   ```sh
   scp -r deploy root@sidekick-agent:/tmp/iq-deploy
   ssh root@sidekick-agent bash /tmp/iq-deploy/bootstrap.sh
   ```

   Verify: `id iq` · `swapon --show` (4G) · `go version`, `node --version`,
   `sudo -u iq /srv/iq/.bun/bin/bun --version` · `systemctl list-timers 'iq-*'`.

3. `[U]` Coolify UI — **Postgres 16** resource, public port **5433**, then:

   ```sh
   docker exec <pg-container> createdb -U postgres app
   docker exec <pg-container> createdb -U postgres app_dev
   ```

4. `[U]` Coolify UI — **Garage** service (community MinIO is unmaintained;
   decision 2026-07-30). Template ships no ports: edit the compose to add
   `ports: ['9002:3900']` (S3 API) before deploying. Then init (layout,
   `iq-api` key, `instantquote` + `instantquote-dev` buckets, grants, CORS)
   via `docker exec <container> /garage …` — and note **Garage validates
   the SigV4 region**: `S3_REGION=garage` must be set in `api.env`.
   Verify: `nc -z 127.0.0.1 9002` and a `--region garage` `list-buckets`.

5. `[U]` Fill `/srv/iq/env/api.env` (DB password, MinIO keys) and
   `/srv/iq/env/web.build.env`. Both are already 0600 `iq:iq`.

6. Traefik routing — set the basicAuth hash (`htpasswd -nb iq '<pw>'`) in
   `deploy/traefik/iq.dynamic.yaml`, then on the server:

   ```sh
   cp deploy/traefik/iq.dynamic.yaml /data/coolify/proxy/dynamic/iq.yaml
   docker logs coolify-proxy --tail 20   # must stay clean
   ```

7. First `git push` — watch gate → build → migrate → swap stream.
   Verify: `ssh iq@sidekick-agent /srv/iq/app/src/deploy/ship status`, then
   `docker exec coolify-proxy wget -qO- http://host.docker.internal:8090/healthz`.

8. Public smoke at `http://iq.37-27-84-96.sslip.io` (basicAuth): click
   through a real quote, upload a model (presigned PUT →
   `s3-iq.37-27-84-96.sslip.io`), log in — the code appears in
   `journalctl -u iq-api` (no Resend yet). Stub checkout only works via
   tailnet (see below); confirm it 403s from the public internet.
   `[U]` then: `/srv/iq/current/api/api promote-admin <your-email>`.

9. `[U]` Cloudflare R2 — create bucket **`iq-minio-backup`** (exactly that
   name: the `iq-minio-backup.service` unit targets it) + an API token; in
   Coolify, add the S3 storage target and a nightly backup schedule on the
   Postgres resource. Verify an execution lands in R2. The object mirror
   uses `rclone copy` (never `sync`) so source-side deletions are NOT
   replicated — the backstop keeps what Garage loses.

10. `[U]` `rclone config` as `iq` (remotes: `minio:` → 127.0.0.1:9002 — the
    label is historical, it points at Garage; set S3 provider "Other",
    region `garage` — and `r2:` → the R2 bucket), then
    `systemctl start iq-minio-backup` and check objects in R2.

11. **Restore drill** (do it once, for real): restore the newest R2 dump
    into a throwaway `app_restore_test` DB, count a known table, drop it.
    Record how long it took here: `restore drill: ____ min on ____-__-__`.

12. `[U]` Mac config note: the Coolify MCP still points at the public IP —
    set `COOLIFY_BASE_URL=http://sidekick-agent:8000` to make it work again.

## Day-2 operations

| What                     | How                                                     |
| ------------------------ | ------------------------------------------------------- |
| Deploy                   | `git push` (docs-only pushes deploy nothing)            |
| Deploy state             | `ship status` — SHAs, service health, healthz, disk     |
| Logs                     | `journalctl -u iq-api -f` / `journalctl -u iq-web -f`   |
| Roll back                | `ship rollback api` or `ship rollback web` (seconds)    |
| Manual deploy            | `ssh iq@sidekick-agent /srv/iq/app/src/deploy/ship all` |
| Login codes (pre-Resend) | `journalctl -u iq-api -g 'login'`                       |
| Break-glass              | Hetzner Cloud console (if SSH/tailnet is gone)          |

`ship` is short for `ssh iq@sidekick-agent /srv/iq/app/src/deploy/ship …` —
alias it in your shell if you like.

**Testing stub checkout** (tailnet-only by design): reach Traefik over
tailnet with the preview Host header —
`curl --resolve iq.37-27-84-96.sslip.io:80:100.114.132.68 …` or an
`/etc/hosts` line `100.114.132.68 iq.37-27-84-96.sslip.io` on the Mac.

## Dev on the server (never touches prod)

```sh
ssh iq@sidekick-agent
git clone /srv/iq/git/app.git /srv/iq/dev   # once
cd /srv/iq/dev
deploy/dev api            # Go API :8091 · DB app_dev · bucket instantquote-dev
deploy/dev api migrate    # migrate the DEV database only
deploy/dev web            # Vite HMR :3001, /api → :8091
```

Preview from the laptop: `http://100.114.132.68:3001` (**tailscale IP, not
the hostname** — Vite's allowedHosts blocks unknown hostnames but allows
IPs). Ship it: commit in `/srv/iq/dev`, `git push origin main` — the clone's
origin _is_ the bare repo, so the same gate → deploy fires.

The root `Makefile` (`make dev`, `db-up`, compose Postgres/MinIO) is
**Mac-only**; on the server the data layer is the Coolify resources above.
`/srv/iq/app/src` belongs to the hook — hand-edit only `/srv/iq/dev`.

## Domain day (~30 min)

1. Buy the domain; DNS A records `@` and `s3` → 37.27.84.96.
2. `/data/coolify/proxy/dynamic/iq.yaml`: fill `<domain>`, uncomment the
   production stanza, delete the preview stanza (hot-reloads on save).
3. The `iq-s3` router stays ours in production too (Garage has no Coolify
   FQDN wiring) — the prod stanza includes its https variant.
4. `/srv/iq/env/api.env`: S3 endpoints → `s3.<domain>`, `S3_USE_SSL=true`,
   `PUBLIC_BASE_URL=https://<domain>`, `COOKIE_SECURE=true`.
5. `/srv/iq/env/web.build.env`: `VITE_SITE_URL=https://<domain>`.
6. `ship all` (web config is build-baked — this rebuild is required).
7. Resend + DKIM: `plans/engineering/runbooks/email-dns.md`; set
   `RESEND_API_KEY` + real `EMAIL_*`, `ship api`… then add a free uptime
   pinger on `https://<domain>/healthz`.

## Caveats & pressure valves

- **Migrations run while the old binary still serves** (then the swap
  restarts it). Additive/expand-contract only; a locking migration gets a
  manual window (`systemctl stop iq-api` first).
- **RAM**: web builds are capped (`NODE_OPTIONS=--max-old-space-size=1536`,
  `nice`, sequential) + 4G swap. If the box is starved, build on the Mac:
  `bun run build` with the same `web.build.env` values, then
  `rsync -a .output/ iq@sidekick-agent:/srv/iq/releases/web-<sha>/`, flip
  the `current/web` symlink, `sudo systemctl restart iq-web`.
- **Disk** (38G, ~65% used): `ship status` prints usage; valves are
  `go clean -cache` and `bun pm cache rm` under `/srv/iq`. **Never**
  `docker system prune` — other tenants' images live there.
- **After a Coolify upgrade**: confirm `/data/coolify/proxy/dynamic/iq.yaml`
  still exists and routes (`curl -fsS http://iq.37-27-84-96.sslip.io/healthz`).
- **The public-exposure invariant is the Hetzner Cloud Firewall.** Both apps
  (and docker-published 5433/9002) bind 0.0.0.0; the ONLY thing keeping
  :8090/:3010/:5433/:9002 off the internet — and the stub-payments Traefik
  guard meaningful — is the cloud firewall allowlisting exactly 80/443
  (verified 2026-07-30). After ANY firewall change, re-verify:
  `for p in 8090 3010 5433 9002; do nc -z -G4 37.27.84.96 $p && echo "$p OPEN(!)"; done`
- **If UFW is ever enabled** on this box, allow the docker bridge networks —
  Traefik reaches the apps via `host.docker.internal`.
- **Secrets map**: server runtime — `/srv/iq/env/*` (0600); Mac dev —
  `instant-quote/.env`; `BAMBU_CLOUD_TOKEN` expires ~90 days (rotate in
  `/srv/iq/env/api.env`, `systemctl restart iq-api`). Nothing secret ever
  enters the repo.
- **CI/staging are dormant, not deleted** — the day a second person or real
  revenue arrives, GitHub Actions slots in front of the same `ship`
  mechanism unchanged (old design: plan 03 body).
