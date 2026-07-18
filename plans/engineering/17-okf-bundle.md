# 17 — OKF knowledge bundle (repo docs infrastructure)

> **Status: ⬜ Not started** (as of 2026-07-18) — decision recorded, execution deferred; nothing in the repo carries OKF frontmatter yet.

## 1. Context

The repo became business-wide in the 2026-07-17 restructure (code + plans + research + business context, worked by humans and multiple agents). OKF — the Open Knowledge Format, [spec v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) — standardizes exactly this shape: a bundle of markdown files with YAML frontmatter (required `type`; recommended `title`, `description`, `tags`, `timestamp`), optional reserved `index.md` (listings) and `log.md` (changelog), untyped markdown cross-links, and deliberately tolerant consumers.

**Decision (2026-07-18):** adopt OKF fully — the whole repo becomes a conforming v0.1 bundle. Chosen over the alternatives considered (skip; OKF-lite on `research/`+`business/` only; export adapter that generates a bundle without touching the repo). The advisor review recommended against full adoption — the repo already carries OKF's substance in README index tables, status banners, and git history, and OKF is a v0.1 proof-of-concept — and was overruled: the owner wants conformance and the interop option it buys.

Design goal for execution: full conformance **without creating second sources of truth**. Three protective decisions, locked here:

- **No `status` in frontmatter.** The `> **Status:**` banner + ROADMAP mirror stays the only status mechanism (AGENTS.md invariant).
- **No `timestamp` field.** Git owns recency; a hand-maintained timestamp rots immediately (the spec makes it optional).
- **No per-directory `index.md`, no `log.md`.** README.md tables remain the human indexes (OKF consumers may synthesize indexes; both reserved files are optional). Git history + dated plan amendments serve the log role. Only ONE new `index.md` at repo root, to declare `okf_version`.

## 2. Scope: what gets frontmatter

Every tracked `.md` outside `instant-quote/src/` — 42 files at decision time (`git ls-files '*.md'`; re-inventory at execution). `instant-quote/src/content/blog/*.mdx` is application source with its own MDX frontmatter pipeline — out of bundle, declared as such in root `index.md`. Frontmatter goes ABOVE existing content; plan bodies are otherwise untouched (the append-only convention holds — frontmatter is metadata, not a body rewrite).

## 3. Type vocabulary (to be documented in AGENTS.md)

| type | Files |
| --- | --- |
| `Overview` | `README.md` (root) |
| `Operating Manual` | `AGENTS.md` |
| `Tool Config` | `CLAUDE.md` (frontmatter above the `@AGENTS.md` import — verify the import still resolves, see §7) |
| `Index` | `plans/README.md`, `plans/advisor/README.md`, `plans/seo/00_README.md`, `business/README.md`, `research/README.md` |
| `Roadmap` | `plans/engineering/ROADMAP.md` |
| `Decision Record` | `plans/engineering/DECISIONS.md` |
| `Plan` | `plans/engineering/NN-*.md`, `plans/advisor/NNN-*.md`, `plans/seo/NN_*.md` |
| `Product Brief` | `business/product.md` |
| `Competitor Profile` | `research/competitors/*.md` |
| `Research` | other `research/` `.md` artifacts (rule for future files) |
| `Project README` | `backend/README.md`, `instant-quote/README.md` |
| `Archive` | `archive/*.md` |

Frontmatter shape (fields in this order; `tags` only where they add cross-cutting value, e.g. `[pricing]`, `[seo]`):

```yaml
---
type: Plan
title: 02 — File storage
description: MinIO uploads, MakerWorld tee, retention sweep, mesh recompute at submit.
---
```

`title` = the doc's H1 (or ROADMAP roll-up name for plans); `description` = reuse the existing curated one-liners from the area README tables / ROADMAP lines — do not author new summaries where one exists.

## 4. New files

1. **`index.md` (repo root)** — the only reserved file added. Frontmatter `okf_version: "0.1"` (spec §11: the root index may carry the version declaration), then a progressive-disclosure listing mirroring README.md's repo map (link + description per area, sourced from the same table). One extra paragraph: bundle scope statement (knowledge bundle = repo docs; `backend/` + `instant-quote/` code and `instant-quote/src/**` app content are the systems the knowledge describes; no `log.md` — git history is the log).
2. **`scripts/check-okf.ts` (repo root, run with Bun)** — conformance gate so the convention can't silently drift: for every tracked `.md` outside `instant-quote/src/`, excluding reserved `index.md`, assert parseable YAML frontmatter with non-empty `type`; assert `type` is from the vocabulary above; assert root `index.md` declares `okf_version`. ~50 lines, no new deps (hand-parse the `---` block; follow the style of `instant-quote/scripts/check-strings.ts`). Wire a root Makefile target `check-okf` and add it to the root `test` target.

## 5. Edits to existing conventions

- **AGENTS.md**: add an "OKF bundle" invariant bullet — every new `.md` gets frontmatter from birth (`type` from the vocabulary table, which lives in AGENTS.md); `status` stays in banners, never frontmatter; the frontmatter `description` and the area README table row should be the same sentence. Add `make check-okf` to the verification gates table.
- **README.md / area READMEs**: no structural change — each gets its own frontmatter stamp only.
- **research/ + business/ convention** ("artifact ⇒ README table row in the same commit") — unchanged; the frontmatter description mirrors the row.

## 6. Known cosmetic effects (accepted at decision time)

- GitHub renders frontmatter as a metadata table above README content — visible on the repo landing page.
- CLAUDE.md's frontmatter rides along into agent context each session (~4 lines of noise).
- Nothing parses these files programmatically today (Go test comments reference paths only), so no functional risk.

## 7. Execution order & verification

Order: (1) `scripts/check-okf.ts` + Makefile target first (red); (2) root `index.md`; (3) stamp all files, sourcing descriptions from existing tables (mechanical; parallelize by area); (4) AGENTS.md invariant + gates row; (5) gate green; one commit.

Done when:

- `make check-okf` passes — and demonstrably bites: temporarily strip one file's frontmatter → it fails → restore.
- `cd instant-quote && bun run format:check` clean (Prettier normalizes frontmatter it can see); `make test` still green.
- CLAUDE.md import chain verified: AGENTS.md content still loads into a fresh agent session despite frontmatter above `@AGENTS.md`. If the import breaks: STOP, leave CLAUDE.md unstamped, note the exemption in root `index.md`.
- GitHub rendering of root README.md frontmatter spot-checked after push (cosmetic only).
