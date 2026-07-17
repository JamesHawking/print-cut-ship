# Plan 004: Frontend dependencies pinned to the versions the lockfile already resolves

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/advisor/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 64dfb98..HEAD -- instant-quote/package.json instant-quote/bun.lock`
> If either file changed since this plan was written, re-derive the resolved
> versions from the live `bun.lock` before proceeding (the table below may be
> stale); if the "latest" specifiers are already gone, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (pinning can surface peer-dependency warnings "latest" was masking)
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `64dfb98`, 2026-07-17

## Why this matters

Seven core packages — including the router, the SSR framework, and the server
runtime — are declared as `"latest"` (and `nitro` as `npm:nitro-nightly@latest`,
a nightly that publishes daily). `bun.lock` makes today's install reproducible,
but the *manifest intent* is unpinned: any lockfile regeneration, CI install
without the lockfile, or `bun update` silently adopts whatever shipped that
day, with no review. The fix is to pin each specifier to the exact version the
lockfile already resolves — a zero-behavior-change edit, because those are the
versions running right now. Two devtools packages also move out of production
`dependencies` where they don't belong.

## Current state

- `instant-quote/package.json` — the offending specifiers (line numbers ~26-41
  in `dependencies`, ~54 in `devDependencies`):

  ```json
  "@tanstack/react-devtools": "latest",
  "@tanstack/react-query": "^5.101.2",
  "@tanstack/react-router": "latest",
  "@tanstack/react-router-devtools": "latest",
  "@tanstack/react-router-ssr-query": "latest",
  "@tanstack/react-start": "latest",
  ...
  "nitro": "npm:nitro-nightly@latest",
  ```

  and in `devDependencies`:

  ```json
  "@tanstack/devtools-vite": "latest",
  ```

- Resolved versions read from `instant-quote/bun.lock` at commit `64dfb98`
  (**re-verify against the live lockfile before editing** — command in Step 1):

  | Package | Pin to |
  |---------|--------|
  | `@tanstack/react-devtools` | `0.10.8` (+ move to devDependencies) |
  | `@tanstack/react-router` | `1.170.18` |
  | `@tanstack/react-router-devtools` | `1.167.0` (+ move to devDependencies) |
  | `@tanstack/react-router-ssr-query` | `1.167.1` |
  | `@tanstack/react-start` | `1.168.28` |
  | `nitro` | `npm:nitro-nightly@3.0.1-20260712-095235-05bf1c38` |
  | `@tanstack/devtools-vite` | `0.8.1` (already devDependencies) |

- The devtools packages are **not** imported anywhere in `src/` (verified by
  grep at planning time); they are wired through the `devtools()` plugin in
  `instant-quote/vite.config.ts` (~line 144), which is a dev-time Vite plugin —
  hence devDependencies is the correct home.

- Known family skew (context, deliberately NOT "fixed" here): the resolved set
  mixes minors (`react-router 1.170.18`, `router-plugin 1.168.20`,
  `react-start 1.168.28`). This exact set currently typechecks, builds, and
  passes tests — pinning preserves it. Aligning the whole `@tanstack/*` family
  to one release train is a separate, riskier upgrade; do not attempt it in
  this plan.

## Commands you will need

| Purpose | Command (from `instant-quote/`) | Expected on success |
|---------|--------------------------------|---------------------|
| Install | `bun install` | exit 0; no resolution changes beyond specifier bookkeeping |
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test` | all pass |
| Lint | `bun run lint` | exit 0 |
| Build (the real gate — exercises nitro) | `bun run build` | exit 0, `.output/` produced |

## Scope

**In scope** (the only files you should modify):
- `instant-quote/package.json`
- `instant-quote/bun.lock` (via `bun install` only — never by hand)

**Out of scope** (do NOT touch):
- Upgrading/downgrading ANY package to a different version than the lockfile
  already resolves — this plan is pin-in-place only.
- `vite`, `typescript`, `react`, or any caret-ranged dependency — their ranges
  are the repo's deliberate choice.
- `vite.config.ts` — the devtools plugin wiring stays as is.
- Aligning the `@tanstack/*` family versions (see Current state).

## Git workflow

- Branch: `advisor/004-pin-frontend-dependencies`; message style matches repo
  log (e.g. "Frontend: pin latest-specified deps to lockfile-resolved versions").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-verify the resolved versions from the live lockfile

```sh
cd instant-quote && grep -oE '"(@tanstack/(react-router|react-start|react-router-ssr-query|react-devtools|react-router-devtools|devtools-vite)|nitro-nightly)@[0-9][^"]*"' bun.lock | sort -u
```

**Verify**: output matches the Pin-to table above. If any version differs,
use the live lockfile's version (the principle is pin-what-is-resolved) and
note the difference in your report.

### Step 2: Edit `package.json`

- Replace each `"latest"` with the exact version from Step 1 (no `^`/`~` — the
  point is exactness; note the repo already uses carets elsewhere, but for
  these fast-moving pre-1.0/nightly packages exact pins are the deliberate
  exception).
- `nitro`: `"npm:nitro-nightly@3.0.1-20260712-095235-05bf1c38"` (keep the
  `npm:` alias form).
- Move `"@tanstack/react-devtools"` and `"@tanstack/react-router-devtools"`
  entries from `dependencies` to `devDependencies` (keep alphabetical order
  within each block — match the file's existing ordering).

**Verify**: `grep -c '"latest"' package.json` → `0`.

### Step 3: Reinstall and confirm nothing actually changed

```sh
bun install
git diff bun.lock | head -50
```

**Verify**: `bun install` exits 0. The `bun.lock` diff must only reflect
specifier bookkeeping (e.g. `"latest"` → the pinned version in the
dependencies metadata) — **no package may resolve to a different version**.
If any resolved version changes, STOP (see below).

### Step 4: Full verification pass

```sh
bun run typecheck && bun run lint && bun test && bun run build
```

**Verify**: all exit 0; build produces `.output/`. Then start the dev server
briefly (`bun run dev`) and load `http://localhost:3000/pl` — page renders,
no devtools-related import errors in the terminal (confirms the
devDependencies move didn't break the dev-time plugin).

## Test plan

No new tests — this is a manifest-only change. The gates are the existing
suite + typecheck + the production build (which exercises the nitro pin
hardest).

## Done criteria

ALL must hold:

- [ ] `grep -c '"latest"' instant-quote/package.json` → 0
- [ ] Both devtools packages are under `devDependencies`
- [ ] `git diff bun.lock` shows no resolved-version changes
- [ ] `bun run typecheck && bun run lint && bun test && bun run build` all exit 0
- [ ] Dev server renders `/pl` with no plugin errors
- [ ] `git status` shows only `package.json` + `bun.lock` modified
- [ ] `plans/advisor/README.md` status row updated

## STOP conditions

Stop and report back if:

- Step 3 shows any package resolving to a **different version** after
  pinning — that means the lockfile and manifest disagree in a way this plan's
  table didn't anticipate; report the diff rather than accepting the new
  resolution.
- `bun install` emits peer-dependency **errors** (warnings are reportable but
  non-blocking) after the devDependencies move.
- `bun run build` fails — do not chase nitro/TanStack version combinations;
  that is the family-alignment work explicitly out of scope.

## Maintenance notes

- Future dependency updates are now deliberate: bump the pin, run the Step 4
  gate. Consider aligning the whole `@tanstack/*` family to one release train
  as a follow-up (out of scope here; MED risk).
- `nitro-nightly` remains a pre-release chain (rolldown/h3-rc/alpha transitive
  deps) — pinned, it's stable; the real exit is adopting a stable Nitro release
  once TanStack Start supports one. Revisit when `plans/engineering/03-deploy-ci.md`
  (production build) starts.
- Reviewer should scrutinize: the `bun.lock` diff (must be bookkeeping-only)
  and that no `^` crept into the new pins.
