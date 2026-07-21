# plans/ — all forward-looking work

Four corpora, one root. Each is self-indexing; this file is the map.

| Corpus          | What it is                                                                                                                   | How status works                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `engineering/`  | Production-readiness roadmap: 16 numbered topic plans plus `ROADMAP.md` (roll-up) and `DECISIONS.md` (locked tech decisions) | `> **Status:**` banner in each plan is the source of truth, mirrored in ROADMAP's roll-up line |
| `advisor/`      | Implementation plans from external codebase audits (the `improve` skill), prioritized with dependencies                      | Status table in `advisor/README.md` (TODO / IN PROGRESS / DONE / BLOCKED / REJECTED)           |
| `seo/`          | Six executable build prompts for the SEO/content surface, in dependency order                                                | Table in `seo/00_README.md`; shipped state is reflected in engineering plan 13's banner        |
| `explorations/` | Dated point-in-time analyses and audits — snapshots that inform plans but aren't sequenced work                              | None — each file is a standalone dated snapshot                                                |

Rules (normative versions in root [`AGENTS.md`](../AGENTS.md)):

- When a status changes, update the corpus index in the same commit.
- New sequenced plans: `NN-kebab-title.md` in the right corpus (advisor uses
  `NNN-`). Give each a status banner or table row from birth.
- Completed plans stay in place with their DONE status — `archive/` at the
  repo root is for artifacts, not plans.

History: this corpus root was created in the 2026-07-17 business-wide
restructure from `Plans/` (→ `engineering/`), `advisor-plans/` (→ `advisor/`),
and `seo_prompts/` (→ `seo/`).
