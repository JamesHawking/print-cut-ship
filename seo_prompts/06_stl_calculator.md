# Prompt 06: free STL cost calculator, the linkable asset (run after 01)

## Context

Existing codebase: instant-quote prototype for an EU FDM 3D printing service (Poland-based, DACH-focused). TanStack Start + TypeScript strict, Bun, TanStack Query, shadcn/ui on Tailwind v4, Oxlint. Already built: STL/3MF/OBJ parsing in a Web Worker (volume, bounding box, surface area, triangle count), pricing engine `src/lib/pricing.ts`, 3D preview (react-three-fiber), SEO foundation from prompt 01 (locales, Seo, JsonLd, QuoteCta).

## Goal

A free, standalone, no-signup STL analysis and cost-estimation tool at its own URL. Purpose: earn backlinks from forums, YouTube descriptions and tool directories, and rank for "3D print cost calculator" queries. It must be useful to people who will never order from us (that is what makes it linkable), while converting the subset who have a real project.

## Requirements

1. **Route.** `/tools/3d-print-cost-calculator` (de: `/de/tools/3d-druck-kosten-rechner`, pl translated slug), hreflang wired. A `/tools` index page listing this (and future) tools.
2. **Function.** Reuse the existing worker and pricing engine, do not fork them:
   - Upload STL/3MF/OBJ → volume, bounding box, surface area, triangle count, estimated weight per material, estimated print time (from the existing throughput model).
   - Cost breakdown in two modes, side by side: "print it yourself" (user-editable inputs: filament €/kg with per-material defaults, printer wattage, electricity €/kWh, failure-rate %) and "order it" (our live price, computed from `pricing.ts`, clearly labeled).
   - All self-print inputs persist in localStorage; sensible EU defaults.
   - Everything client-side; state the privacy point prominently: "Your file never leaves your browser on this page."
3. **Shareability.**
   - "Copy results" button producing a clean plaintext block (dimensions, volume, weight, time, both costs) for forum posts, and a "Download report" as a simple print-styled page.
   - OG image and meta specifically written for link sharing.
4. **Honesty rule.** The self-print column must be fair (real defaults, failure rate included but not inflated). If self-printing is cheaper for the uploaded part, say so plainly. The tool's credibility is the asset; the conversion comes from the QuoteCta ("skip the printing: this part, delivered by {date}, for {price}") shown with the results.
5. **SEO page content.** Below the tool: 500-700 words (en+de) explaining the math (formula, what drives cost, why quantity changes unit price) linking to `/pricing` and material pages; FAQ accordion (5 questions) with `FAQPage` schema; `SoftwareApplication` structured data for the tool; `BreadcrumbList`.
6. **Performance.** Tool interactive < 2 s on mid-range hardware; worker reuse means no main-thread stalls; Lighthouse SEO 100, performance 90+.
7. **Funnel.** Events: `tool_file_analyzed {volume_bucket}`, `tool_mode_compared`, `cta_upload_clicked {source_page: "tools/calculator"}`. These measure whether the asset converts, not just attracts.

## Out of scope

No account, no saved history beyond localStorage, no API, no embed widget (later), no G-code analysis, no multi-file.

## Definition of done

Dropping a benchy STL shows dimensions, weight, print time and both cost columns in under 3 seconds; self-print inputs persist across reloads; copy-results block pastes cleanly into a forum post; schema validates; en+de content complete; `bun test` and `bun run lint` pass (including a unit test that the "order it" price equals the quote tool's price for the same file and config).
