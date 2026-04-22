# Basta integration

How our platform talks to Basta (`basta.app`), the headless bidding engine. Basta owns all bidding/sale lifecycle/bid state; our platform owns everything else (identity, ordering, seller UI, payments, media, ...).

## Today's integration surface (very thin)

Only three Management API mutations are wired:
- `createBidderToken(userId, ttl)` — mints a JWT for a platform user to use the Client API. See [`backend/src/routes/basta-token.ts`](../../../backend/src/routes/basta-token.ts).
- `createSale(title, description, currency, closingMethod, closingTimeCountdown, bidIncrementTable)` — called from our seller `/api/seller/auctions/:id/publish`.
- `createItemForSale(saleId, title, description, startingBid, reserve, openDate, closingDate)` — called per-lot during publish.
- `publishSale(saleId)` — transitions sale to `PUBLISHED`.

See [`backend/src/lib/basta.ts`](../../../backend/src/lib/basta.ts) for the GraphQL client and typed wrappers.

**That's it.** Nothing else is integrated as of 2026-04-21. No webhooks, no WebSocket subscriptions, no Client API reads, no bid placement. The `MaxBidSection` UI component pretends to place bids but only sets local state — real wiring comes in M1.

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
- [ ] `bidOnItem(saleId, itemId, amount, type)` — M1 for MAX, M3 for NORMAL.
- [ ] `sale(saleId)` and `item(saleId, itemId)` public reads — M3 possibly for initial hydration.
- [ ] `itemUpdates(saleId, itemId)` subscription — M3. Returns `currentBid, bidCount, timeRemaining, status, myBidStatus`.
- [ ] `saleUpdates(saleId)` subscription — M3.

### Webhooks (Basta → our backend)
- [ ] `BidOnItem` — M2. Upsert to `bids` table, join against `profiles` for displayable bid feed.
- [ ] `SaleStatusChanged` — M2. Map to `auctions.status`.
- [ ] `ItemsStatusChanged` — M2. Update `lots.live_status`.
- [ ] Signature verification — **spec unknown**. Filed in risks.

## Bid types

Two. Both are documented in the Basta skill reference (richer than our local docs):

- **`MAX`** — proxy bidding. User sets maximum they're willing to pay. Basta auto-bids incrementally on their behalf until they win, are outbid by a higher max, or hit their max. Reacts to counter-bids automatically.
- **`NORMAL`** — direct bid at a specific amount. Must align with increment table. Does not react.

Our UI uses both:
- "Set max bid" pre-auction and "Set max bid" on the live page → `type: MAX`.
- One-tap "BID $X" live button + custom-bid input → `type: NORMAL`.

`allowedBidTypes: [MAX, NORMAL]` should be set on every item at `createItemForSale` time (currently **omitted** — fix in M1).

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

All values in cents. M1 will mirror this onto `auctions.bid_increment_table jsonb` so the client can compute next valid bid without another Basta round-trip.

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

Client-side (for M1+): `NEXT_PUBLIC_BASTA_CLIENT_URL` — `https://client.api.basta.app/graphql`. `NEXT_PUBLIC_BASTA_WS_URL` — `wss://client.api.basta.app/query`. Not yet set.

## Open unknowns

See [risks/basta-questions.md](../risks/basta-questions.md) for the live list. Top items:
1. Is there a `closeItem` / `updateItem(closingDate)` primitive?
2. Is there a pause-sale primitive?
3. Can `bidIncrementTable` be updated on a published sale?
4. What's the webhook signature algorithm + header?
5. Does any subscription include bidder `userId` (for live bid feeds with names)?

Cross-reference: [GAP_ANALYSIS_AND_PLAN.md Appendix A](../../../GAP_ANALYSIS_AND_PLAN.md) has the full Q&A deep-dive from the Basta skill research.

---

_Last verified: 2026-04-21_
