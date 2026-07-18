# voice.md — how MICRO_FACTORY writes

Copy standard for all user-facing text (`instant-quote/src/lib/i18n/{pl,en}.ts`
and content pages). Extends the brand personality in [`product.md`](product.md):
engineering-grade honesty — plain and exact. The voice states the price, shows
the math, and says plainly when it can't auto-quote something.

## One promise, everywhere

File in → itemized price + real ship date out. Every string either **delivers
the number** or **explains the number**. If a line does neither, cut it.

## Two registers, zoned

Every string belongs to exactly one register, decided by the surface it
renders on — never mix within a string.

| Register | Surfaces | Rules |
| --- | --- | --- |
| **Instrument** | mono/uppercase chrome: dropzone states, machine log, status chips, kickers, wordmark grammar (`MICRO_FACTORY`, `Dostęp_do_zamówień`), spec strips | Terse. No persuasion verbs, no explanations, no punctuation beyond `·` and `—`. Log tags (`RECV`, `PRICE`, …) and the `$` command line stay untranslated. |
| **Human** | prose: subheads, FAQ, dialogs, errors, empty states, emails | Plain "we"/"ty". Explains cause and next action. Never decorates, never shouts. |

The machine persona ("maszyna odpowie" / "the machine answers") lives on
instrument-adjacent surfaces (hero sub, demo). Everywhere else the humans
speak ("wysłaliśmy potwierdzenie", "we emailed a confirmation").

## CTA taxonomy — one verb per intent

| Intent | PL | EN | Where |
| --- | --- | --- | --- |
| Start a quote | `Wyceń …` | `Price …` | header CTA, section CTAs |
| Literal file action | `Wgraj / Upuść / Wybierz plik` | `Upload / Drop / Choose file` | dropzone and buttons that open the file picker |
| Resume | `Wróć do wyceny` | `Resume quote` | header chip |

Never "Get a quote" in EN — it is the request-a-quote pattern we position
against (see product.md anti-references).

## Errors

Cause + next action, human register, one sentence each where possible. Never
internals: no env-var names, no status codes, no stack language. If we can't
do something, say so and give the path ("wgraj plik bezpośrednio", "spróbuj
za moment").

## Locale mechanics

| | PL | EN |
| --- | --- | --- |
| Register | informal "ty"; **lowercase** "twój/twoja" mid-sentence | sentence case everywhere |
| Decimals | comma (`0,9 mm`) | point (`0.9 mm`) |
| Quotes | „…” | “…” |
| Units | NBSP before units; `src/lib/format.ts` is the number-formatting source of truth | same |
| Separators | `·` between facts, `—` for asides | same |

## Glossary

wycena = quote · silnik wyceny = quote engine · rozbicie = breakdown ·
termin = lead time · przewodnik = guide · Baza wiedzy = Knowledge base (nav
and page heading use the same name in each locale) · D+1/D+2 = courier
transit convention · Meta titles end `| MICRO_FACTORY`.

EN is never a literal translation of PL (or vice versa) — craft each line in
the language where it's strongest, then write the counterpart natively.
