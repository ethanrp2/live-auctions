# Basta integration

How our platform talks to Basta (`basta.app`), the headless bidding engine. Basta owns all bidding/sale lifecycle/bid state; our platform owns everything else (identity, ordering, seller UI, payments, media, ...).

## Today's integration surface

**Management API** (backend, server-to-server):
- `createBidderToken(userId, ttl)` — mints a JWT for a platform user to use the Client API. See [`backend/src/routes/basta-token.ts`](../../../backend/src/routes/basta-token.ts).
- `createSale(...)`, `createItemForSale(..., allowedBidTypes: [MAX, NORMAL])`, `publishSale(saleId)` — seller publish flow. See [`backend/src/routes/seller/publish.ts`](../../../backend/src/routes/seller/publish.ts).

**Client API** (frontend, authenticated with bidder token):
- `bidOnItem(saleId, itemId, amount, type: MAX)` — live as of M1. See [`lib/basta/client.ts`](../../../lib/basta/client.ts).

**Backend helper:**
- `GET /api/basta/bid-support/:lotId` → `{ saleId, itemId, allowedBidTypes, bidIncrementTable, closingTimeCountdownMs, startingBidCents, auctionStatus }`. See [`backend/src/routes/basta-bid-support.ts`](../../../backend/src/routes/basta-bid-support.ts).

**Webhooks** (Basta → our backend):
- `POST /api/webhooks/basta` handles `BidOnItem`, `SaleStatusChanged`, `ItemsStatusChanged` with idempotency (PK on `webhook_events.idempotency_key`). See [`backend/src/routes/webhooks/basta.ts`](../../../backend/src/routes/webhooks/basta.ts) and handlers under [`backend/src/lib/webhook-handlers/`](../../../backend/src/lib/webhook-handlers/). Wired as of M2.

**Not yet wired** (as of 2026-04-21):
- `NORMAL` bid placement (M3 live buyer screen will use it).
- WebSocket subscriptions (`itemUpdates`/`saleUpdates`) — M3.
- Webhook signature verification — blocked on Basta (Q5 in `basta-questions.md`). Currently using an optional shared-secret header `x-basta-secret` gated by `BASTA_WEBHOOK_SECRET` env var.
- Close-item-now / pause-sale primitives — filed as open questions to Basta.

See [`backend/src/lib/basta.ts`](../../../backend/src/lib/basta.ts) for the backend GraphQL client and typed wrappers; [`lib/basta/client.ts`](../../../lib/basta/client.ts) for the frontend Client API wrapper.

## Bid flow: buyer sets a MAX bid (M1)

```
Browser                     Our Fastify                Basta
  |                              |                       |
  | GET /api/basta/bid-support/  |                       |
  |   :lotId                     |                       |
  |----------------------------->|                       |
  |                              | (Supabase SELECT:     |
  |                              |  lots + auctions)     |
  |<-- { saleId, itemId, table } |                       |
  |                              |                       |
  | POST /api/basta-token        |                       |
  |   Bearer <supabase JWT>      |                       |
  |----------------------------->|                       |
  |                              | createBidderToken      |
  |                              |---------------------->|
  |                              |<------ { token, exp } |
  |<-- { token, exp }            |                       |
  |                              |                       |
  | POST /graphql (client.api)   |                       |
  |   Bearer <bidder JWT>        |                       |
  |   bidOnItem(..., MAX)        |                       |
  |------------------------------------------------------->
  |<---------------------------- BidPlacedSuccess |       |
  |          or BidPlacedError (errorCode)                |
```

Error-code handling (per Basta Client API ref):
- `BID_TOO_LOW` → "Your bid is below the next increment."
- `ITEM_CLOSED` → "This lot is no longer accepting bids."
- `INVALID_TOKEN` / `UNAUTHORIZED` → force a fresh bidder token and retry once, then surface as "Your bidding session expired."
- Unknown codes → fall back to Basta's `error` field (human-readable), or a generic message.

## Webhook flow: Basta → our backend (M2)

```
Basta                         Our Fastify                 Supabase
  |                                |                         |
  | POST /api/webhooks/basta       |                         |
  |  { idempotencyKey,             |                         |
  |    actionType, data }          |                         |
  |------------------------------->|                         |
  |                                | (optional secret check) |
  |                                | INSERT webhook_events   |
  |                                | (PK=idempotency_key)    |
  |                                |------------------------>|
  |                                |<--- 23505 = duplicate   |
  |                                |                         |
  |                                | dispatch handler:       |
  |                                |  BidOnItem     -> bids  |
  |                                |  SaleStatus    -> auc.  |
  |                                |  ItemsStatus   -> lots  |
  |                                |------------------------>|
  |                                |                         |
  |                                | UPDATE processed_at OR  |
  |                                |        error message    |
  |                                |------------------------>|
  |<------------------ 200/500 ----|                         |
```

Idempotency is a hard contract: `webhook_events.idempotency_key` is the PK, so a redelivered event short-circuits at the INSERT (returns `{status: "duplicate"}` with 200). Failures return 500 so Basta retries. The audit row is kept either way — `processed_at IS NULL AND error IS NOT NULL` = retriable; `processed_at IS NOT NULL` = done.

Shared-secret gating: if `BASTA_WEBHOOK_SECRET` is set, the handler requires header `x-basta-secret` to match. This is a stopgap until Q5 (real signature spec) is answered.

## The full Basta surface (what we'll add)

### Management API (backend, server-to-server)
- [x] `createBidderToken` — done.
- [x] `createSale` — done.
- [x] `createItemForSale` — done.
- [x] `publishSale` — done.
- [ ] `sale(id)` query — M4, to fetch current leader on SELL.
- [ ] `item(saleId, itemId)` query — M4, same.
- [ ] `createItem` + `addItemToSale` — not planned; sticking with Workflow B (`createItemForSale`).
- [ ] `removeItemFromSale` — possibly for DELETE on published lots (TBD if supported).
- [ ] `updateItem` / `updateSale` — **unknown if exists**. Needed for mid-auction edits + possibly to close-item-now. Filed in [risks/basta-questions.md](../risks/basta-questions.md).

### Client API (frontend + backend both)
- [x] `bidOnItem(saleId, itemId, amount, type: MAX)` — M1. MAX done; NORMAL in M3.
- [ ] `sale(saleId)` and `item(saleId, itemId)` public reads — M3 possibly for initial hydration.
- [ ] `itemUpdates(saleId, itemId)` subscription — M3. Returns `currentBid, bidCount, timeRemaining, status, myBidStatus`.
- [ ] `saleUpdates(saleId)` subscription — M3.

### Webhooks (Basta → our backend)
- [x] `BidOnItem` — M2. Upserts to `bids` table (PK=Basta bidId). Reactive bids land as separate rows with `reactive=true`.
- [x] `SaleStatusChanged` — M2. Maps to `auctions.status` (UNPUBLISHED→draft, PUBLISHED→published, OPEN/CLOSING→live, CLOSED→ended) and stamps `went_live_at`/`ended_at`.
- [x] `ItemsStatusChanged` — M2. Updates `lots.live_status` (UNPUBLISHED/PUBLISHED→upcoming, OPEN→live, CLOSING→closing, CLOSED→closed).
- [ ] Signature verification — **spec unknown**. Filed in risks. Using shared-secret header as stopgap.

## Bid types

Two. Both are documented in the Basta skill reference (richer than our local docs):

- **`MAX`** — proxy bidding. User sets maximum they're willing to pay. Basta auto-bids incrementally on their behalf until they win, are outbid by a higher max, or hit their max. Reacts to counter-bids automatically.
- **`NORMAL`** — direct bid at a specific amount. Must align with increment table. Does not react.

Our UI uses both:
- "Set max bid" pre-auction and "Set max bid" on the live page → `type: MAX`.
- One-tap "BID $X" live button + custom-bid input → `type: NORMAL`.

`allowedBidTypes: [MAX, NORMAL]` is set on every item at `createItemForSale` time as of M1.

## Sale lifecycle

```
UNPUBLISHED → PUBLISHED → OPEN → CLOSING → CLOSED
  ^^^^^^         ^^^^^^^^    ^^^^    ^^^^^^^    ^^^^^^
  draft        awaiting    accepting   in anti-   done
                openDate    bids      snipe ext.
```

Basta manages these transitions based on `openDate` / `closingDate` + `closingTimeCountdown`. Webhooks (`SaleStatusChanged`, `ItemsStatusChanged`) notify us.

The same status enum applies at the item level: `UNPUBLISHED → PUBLISHED → OPEN → CLOSING → CLOSED`.

## Identity bridge

Basta doesn't manage users. We pass any opaque `userId` string to `createBidderToken`. We use `user.id` from Supabase auth (UUID). So:

- `BidOnItem.userId` in webhooks = Supabase `auth.users.id` = `profiles.id`. Direct join.
- Same for subscription payloads (when we subscribe in M3).

## Current bid-increment table

Hardcoded default in [`backend/src/routes/seller/publish.ts`](../../../backend/src/routes/seller/publish.ts):

```ts
const defaultBidIncrementTable = [
  { lowRange: 0, highRange: 100_000, step: 2_500 },        // $0–$1,000: $25 step
  { lowRange: 100_000, highRange: 5_000_000, step: 10_000 }, // $1k–$50k: $100 step
];
```

All values in cents. As of M1 this is mirrored onto `auctions.bid_increment_table jsonb` at publish time (and surfaced via `/api/basta/bid-support/:lotId`) so the client can compute next valid bid without another Basta round-trip. `auctions.closing_time_countdown_ms` is mirrored alongside.

## Closing cadence

Hardcoded `closingTimeCountdown: 30_000` (30s anti-snipe extension). Hardcoded `BASTA_LOT_DURATION_MS = 120_000` (each lot auto-closes 2 minutes after opening, staggered from the sale's `scheduled_date`). See [`backend/src/config.ts`](../../../backend/src/config.ts).

These defaults assume the seller will SELL lots faster than 2 minutes, letting Basta close the sale naturally as the console advances. Stragglers (bids on a SOLD lot) leak until the Basta `closingDate` hits. This is known and ignored for v1 (flagged in risks).

## Concurrency + retries

Publish is idempotent within a 5-minute window via `auction_publish_locks` (see [`backend/src/routes/seller/publish.ts`](../../../backend/src/routes/seller/publish.ts)). Already-published errors from Basta are silently tolerated (`isAlreadyPublishedError`).

No retry logic on `createSale` / `createItemForSale` — if Basta returns a 500, we bail. M2 will add webhook-event idempotency for the inbound direction.

## Environment

Backend needs:
- `BASTA_ACCOUNT_ID` — our account UUID, passed as `accountId` on every mutation.
- `BASTA_API_KEY` — API key header `x-api-key` for the Management API.
- `BASTA_MANAGEMENT_API_URL` — defaults to `https://management.api.basta.app/graphql`.
- `BASTA_BIDDER_TOKEN_TTL_MINUTES` — defaults to 60.
- `BASTA_LOT_DURATION_MS` — defaults to 120_000.

Client-side (used by M1 `bidOnItem` call + future M3 WebSocket):
- `NEXT_PUBLIC_BASTA_CLIENT_URL` — `https://client.api.basta.app/graphql` (default in `lib/basta/client.ts`).
- `NEXT_PUBLIC_BASTA_WS_URL` — `wss://client.api.basta.app/query` (set in `.env.example`; wired in M3).

## Open unknowns

See [risks/basta-questions.md](../risks/basta-questions.md) for the live list. Top items:
1. Is there a `closeItem` / `updateItem(closingDate)` primitive?
2. Is there a pause-sale primitive?
3. Can `bidIncrementTable` be updated on a published sale?
4. What's the webhook signature algorithm + header?
5. Does any subscription include bidder `userId` (for live bid feeds with names)?

Cross-reference: [GAP_ANALYSIS_AND_PLAN.md Appendix A](../../../GAP_ANALYSIS_AND_PLAN.md) has the full Q&A deep-dive from the Basta skill research.

---

_Last verified: 2026-04-21 (M2 shipped — webhook ingestion wired; all three event types smoke-tested against live backend with real BASA sale/item IDs)._
