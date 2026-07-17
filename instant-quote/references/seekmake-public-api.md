# SeekMake Public API — extracted spec + what we took from it

Extracted 2026-07-17 from `seekmake.com/developers-portal/api-docs`. The docs page
is an Angular SPA (unfetchable as HTML); the endpoint definitions live as a data
object (`t0`) embedded in bundle chunk `chunk-QGXFSJSF.js` and were evaluated out
with Node. Relevant to us because mapi-tech.pl (see `mapi-tech-pricing.md`) runs
SeekMake's white-label instant-quote widget.

## Shape

- Base: `https://seekmake.com/api/public/v1`
- Auth: `x-auth-token` (per-business API key, generated in their dashboard) or
  `Authorization: Bearer <JWT>` (per-business, optional expiry). **The caller is
  the manufacturer's own integration** — not an anonymous end customer.
- Storage: files live on `files.seekmake.com` (GCS — file-access responses carry
  `GoogleAccessId` SAS-style tokens).

## Endpoints (6)

| Method + path                                              | Purpose                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `POST /price-estimation/{businessId}?currency=`            | Stateless price calc for one model                          |
| `POST /demand/create-quotes/{businessId}?lang=`            | Create quote/order ("demand"), array body                   |
| `GET /demand/{demandId}`                                   | Read one demand                                             |
| `PUT /demand/{demandId}?sendAdditionalFeeMail=&sendOffer=` | Update demand (status, prices, addresses, payment provider) |
| `GET /demand/access/file/{demandId}?filePath=`             | Short-lived signed URL for a stored model file              |
| `GET /demand/{businessId}/{type}?page=&pageSize=`          | Paginated list, `type ∈ ORDERS\|QUOTES`                     |

Demand lifecycle: quotes and orders are one entity (`type` view switch), with
`demandStatusInfo {status: <SystemStatus id>, substatus: <business-custom string>}`,
`paymentStatus ∈ PENDING_PAYMENT|PAID|PENDING_ADDITIONAL_FEES_PAYMENT`, a
`tracking[]` status history, and `paymentProvider ∈ STRIPE|PAYMEE|FLUTTERWAVE|
BANK_TRANSFER|PAYPAL|PURCHASE_ORDER|MANUAL_VALIDATION`.

## The load-bearing observation: zero server-side geometry verification

`POST /price-estimation` takes everything client-computed and trusts it:
`volume` (string!), `coordinates`/`modelSizes` (bbox), full `slicingData`
(hours, filament_length, weight, number_of_layers, convex_hull…), `dfmData`
anomalies, and — remarkably — the **`material` object including
`material.price` and currency**. The response is just
`{message, data: {price}}`. No hashing, no dedup, no content addressing, no
server re-parse anywhere in the public API.

This is coherent _for them_: the API key holder is the business being priced,
so fabricated inputs only cheat yourself, and marketplace orders get human
review. It does **not** transfer to our anonymous-browser + automated-Stripe
flow — which is why our backend keeps the quote-time recompute from stored
bytes (see `Plans/02-file-storage.md` and the plan-02 completion sequence).

## What we adopted / rejected (decision record, 2026-07-17)

**Adopted:**

- `GET /demand/{demandId}` → our `GET /api/v1/quotes/{id}` read-back
  (audit direction D3; prerequisite for quote links + abandoned-quote email).
- Their signed-URL file-access pattern matches our presigned MinIO GETs —
  validation, no change.
- Dropped the _bit-exact_ client/server mesh-parity requirement from the plan-02
  completion plan: since our server's recomputed numbers are authoritative for
  pricing, the TS and Go engines only need tolerance-level agreement. (SeekMake
  gets away with no server engine at all; we keep ours but idiomatic.)

**Rejected:**

- Trust-the-client pricing inputs — wrong trust model for anonymous traffic.
- Their DTO style: `create-demands` has ~80 required fields including internal
  marketplace state (`platformFee`, `jobDetails.offers[]`, `oldPartners`,
  `priceToMachnieOwner` [sic]) — an auto-generated dump of their Mongo models.
  Cautionary tale; our hand-designed OpenAPI DTOs stay lean.
- Webhooks/demand-update surface — plan-future for us, nothing to copy now.

Full field-level spec (request/response trees with examples) was parsed to
JSON during extraction; regenerate by fetching the current `api-docs` route
bundle and evaluating the `t0` object if this ever needs refreshing.
