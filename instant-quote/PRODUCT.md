# Product

## Register

product

## Platform

web

## Users
Engineers, product designers, hardware startups, and makers who need parts made on demand and want a real price before they talk to anyone. Their context is evaluative and impatient: they have a 3D file in hand, they are comparing options, and they resent quote forms, sales calls, and "request a quote" dead-ends. Most are shipping into Germany and the wider EU. They arrive to answer one question — "what will this part cost, and when can I have it?" — and success is answering it in seconds, with a number they trust enough to act on. There is no separate marketing audience; the person using the tool is the person deciding to buy.

## Product Purpose
An instant quoting tool for an EU (Poland-based) on-demand 3D-printing service. A visitor drops a 3D file and immediately sees a transparent, itemized price with a concrete ship date — no account, no checkout gate, nothing between them and the number. It exists to prove one funnel: upload leads to a believable quote leads to an order click. Success is the quote arriving fast enough and reading honestly enough that the visitor keeps going instead of bouncing to a competitor or a sales form.

## Positioning
The fastest, most transparent way to get a real 3D-printing price in the EU: a full cost breakdown and a real ship date, with no account and no waiting.

## Brand Personality
Confident and transparent, with an engineering-grade honesty. The voice is plain and exact — it states the price, shows the math, and says clearly when it cannot auto-quote something rather than inventing a number. Industrial without being cold: the tool should feel like it was built by people who actually make parts. The dominant feeling in the first ten seconds is trust — no dark patterns, no hidden fees, the breakdown laid bare.

## Anti-references
Weerg and SendCutSend as visual and interaction patterns to avoid: dense configuration walls, prices buried several steps deep, and generic manufacturing-SaaS chrome. Do not make the visitor fill a form or click through stages before a price appears, and do not clutter the surface with options that bury the number they came for.

## Design Principles
The price is never hidden. It appears as soon as the geometry is understood and stays visible while the visitor configures — the number is the center of gravity, not a reward at the end of a flow.

Every number is explainable. Any figure the tool shows can be opened to the line items behind it; transparency is the product, so the breakdown is a first-class surface, not fine print.

Speed is a feature. Requoting on any change is instant and silent — no spinners, no submit button between a choice and its consequence. Waiting is a failure state.

Honest about the edges. When a file can't be auto-priced (STEP) or a part violates a build constraint, say so plainly and offer the real next step, never a fabricated price or a false green light.

No friction to the number. Nothing that isn't required to produce a trustworthy quote — no account, no email wall, no checkout — stands between arrival and price.

## Accessibility & Inclusion
Commit to WCAG 2.2 AA: at least 4.5:1 contrast for body text, full keyboard operability across the drop zone, configuration controls, and the order dialog, and reduced-motion alternatives for any animation. The 3D preview must degrade to a non-WebGL fallback that still communicates the part's dimensions, so the quote is never gated on graphics support.
