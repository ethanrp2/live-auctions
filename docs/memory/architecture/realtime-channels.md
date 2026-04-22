# Real-time channels

Two real-time systems in play. Each owns a distinct slice. Never mix them.

## Two systems, two roles

### 1. Basta WebSocket — bidding truth
- Endpoint: `wss://client.api.basta.app/query` (graphql-ws protocol).
- Auth: bidder token in `connection_init.payload.token`.
- What it carries: current bid, bid count, item status transitions (OPEN/CLOSING/CLOSED), countdown/timeRemaining, `myBidStatus` (per-user via JWT).
- Who owns the state: **Basta**. We read-only.
- Status: **wired in M3**. Client in [`lib/basta/ws.ts`](../../../lib/basta/ws.ts); consumed via [`lib/hooks/use-sale-activity.ts`](../../../lib/hooks/use-sale-activity.ts). Token auto-refresh on reconnect via the bidder-token endpoint.

### 2. Supabase Realtime — platform orchestration
- Endpoint: same Supabase instance (`fkatfnvscuvfejhdblks.supabase.co`).
- Auth: Supabase session.
- What it carries: lot transitions the seller drives (advance current lot, pause, end), buyer questions, bid feed with display names (lifted from webhooks into our `bids` table).
- Who owns the state: **us** (our Postgres). Basta doesn't know about this channel.
- Tables currently on the Realtime publication: `auctions`, `lots`, `bids`, `auction_questions` (verified via `pg_publication_tables` 2026-04-21).

## Why two systems

Basta's WebSocket can't broadcast things Basta doesn't know about: which lot the seller decided is "current" (Basta has no concept of auction ordering), buyer questions, the display name behind a bidder userId. Supabase Realtime fills the gap.

Basta's bid state updates faster than our webhook-then-Supabase-Realtime round-trip. So for the **current bid number** and **countdown**, read Basta WS directly. For **"@JawaD just bid $3,250"** with a name, read Supabase Realtime (fed by `bids` inserts from the webhook handler).

## Channels we'll use (M2+)

| Channel | Backed by | Payload | Purpose | Milestone |
|---|---|---|---|---|
| `auction:<id>:state` | `auctions` row changes | `{ current_lot_id, status, went_live_at, ended_at }` | Buyer live screen reacts to seller-advance and END AUCTION | M4 |
| `bids:<auction_id>` | `bids` rows (filtered) | `{ lot_id, buyer_display_name, amount_cents, placed_at }` | Live bid feed with names | M2 (consumed in M3 via [`lib/hooks/use-bid-feed.ts`](../../../lib/hooks/use-bid-feed.ts)) |
| `auction_questions:<auction_id>` | `auction_questions` rows (filtered) | `{ id, user_display_name, question_text, created_at, dismissed }` | Seller console questions panel | M7 |

## Hydration before subscribing (M3)

Realtime is delta-only — no initial snapshot. The buyer live screen hits `GET /api/auctions/:auctionId/current-state` on mount to get the initial picture (auction status, current_lot_id, all lots in order, last 20 bids per lot, bid_increment_table, closing_time_countdown_ms, basta_sale_id) and *then* opens the Supabase Realtime + Basta WS subscriptions for deltas. See [`backend/src/routes/auction-current-state.ts`](../../../backend/src/routes/auction-current-state.ts). Draft auctions return 404 (no data leak).

## Subscribing pattern

Supabase Realtime filter syntax (v2):
```ts
supabase
  .channel(`bids:${auctionId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'bids',
    filter: `auction_id=eq.${auctionId}`,
  }, (payload) => { /* ... */ })
  .subscribe();
```

Always filter on indexed columns. `bids.auction_id`, `auction_questions.auction_id`, `auctions.id` all have indexes (verify when we write the migrations).

## Security

RLS still applies to Realtime. Buyers can SELECT `bids` (we'll enable public SELECT in M2's migration), but the broadcast payload is only what SELECT would return — so if a column is RLS-hidden, it won't appear. For the bid feed, we deliberately allow public read of bid amounts + buyer display names (consistent with how auction UIs work industry-wide).

`auction_questions` policies today allow sellers-only SELECT for their tenant. That's correct; questions are not public.

## Latency expectations

- Basta WS → browser: ~100–500ms typical (varies).
- Webhook → our backend → Postgres INSERT → Supabase Realtime broadcast → browser: ~400–1500ms.
- Seller console action → Postgres UPDATE → Supabase Realtime → buyer screen: ~200–700ms.

These are rough. Measure in M3/M4.

## Gotchas

- **Bidder token refresh on Basta WS reconnect.** If the token expires during a 2-hour auction, we need to close + reopen the socket with a fresh token. `lib/basta-token.ts` has a 5-min buffer for token refresh but the socket won't automatically use the new token — plan for a reconnect loop in M3.
- **Supabase Realtime free tier limits** — concurrent connections, events/sec. Fine for MVP; check before launch.
- **Stale Realtime messages** when a user backgrounds a mobile tab and returns. Supabase delivers missed messages in a catch-up burst; handle in UI (debounce, collapse duplicates).

---

_Last verified: 2026-04-21 (M3 in progress — Basta WS wired via `lib/basta/ws.ts`; `bids` Realtime consumed via `lib/hooks/use-bid-feed.ts`)._
