# Glossary — auction terms

Domain terms used throughout code + docs. When something is ambiguous, this is canon.

## Bidding

- **Lot** — the thing being sold. One item (or grouped items) within an auction. `lots` table.
- **Sale** — Basta's word for our "auction". One sale contains many items (our lots). Both terms appear; in our code `auctions` maps to Basta sales and `lots` maps to Basta items.
- **Starting bid** — the minimum opening bid for a lot. Platform-set at publish time.
- **Reserve** — the minimum price the lot must reach to be sold. If bidding ends below reserve, the lot doesn't sell (seller's prerogative to pass or re-list). Optional; `0` = no reserve.
- **Estimate (low / high)** — catalog price range, e.g. "$2,400–$3,000". Not enforced; informational for buyers to gauge value. Both sides of a range may equal the same number ("$2,500–$2,500") in the Figma designs.
- **Current bid** — the highest active bid amount on a lot at this moment.
- **Max bid** — a bidder's ceiling in proxy bidding. Basta's engine auto-places reactive bids up to this amount on their behalf (see [architecture/basta-integration.md](../architecture/basta-integration.md#bid-types)).
- **Normal bid** — a one-shot bid at a specific amount. Does not react to counter-bids.
- **Increment table** — the schedule of minimum step-ups at different price ranges. E.g., $0–$1,000 increments by $25, $1,000–$5,000 by $100. Defined per sale in Basta.
- **Anti-snipe / closing countdown** — when a bid arrives in the final seconds before `closingDate`, Basta extends the clock by `closingTimeCountdown` ms to give other bidders a chance. Our default: 30s.

## Auction flow

- **Draft** — `auctions.status='draft'`. Seller is editing. Not visible to buyers. Not in Basta.
- **Published** — `auctions.status='published'` AND `basta.status='PUBLISHED'`. Visible on storefront. Not yet accepting bids.
- **Live / Open** — `auctions.status='live'` AND `basta.status='OPEN'`. Current bidding.
- **Ended** — `auctions.status='ended'`. All lots closed. Orders being processed.
- **Seller advance (NEXT LOT)** — platform-side pointer (`auctions.current_lot_id`). Basta doesn't know about this; it only knows about Basta-wide `closingDate` per item. The seller advances the pointer; the buyer UI re-renders accordingly.
- **SELL** — platform action. Seller accepts the current top bid on the current lot. Creates an `orders` row, locks the lot's state, advances the pointer. Basta still considers the item OPEN until its `closingDate`; stragglers are ignored.
- **PASS** — platform action. Seller closes the lot without sale (e.g., bids never hit reserve, or seller decides not to sell). No order.

## Commerce

- **Tenant / House** — one auction-house-as-customer on our platform. `tenants` table. Has a subdomain, branding, Stripe Connect account, sellers.
- **Buyer** — user with no seller role. Can set max bids, bid live, win lots.
- **Seller** — user with `is_seller=true` tied to a tenant. Runs the console.
- **Consignor** — the original owner of a lot (seller may represent many consignors). Not modeled in v1.
- **Platform fee** — what we take from each sale. Flat 5% for v1 (ADR-005 pending in M6).
- **Seller fee** — what Stripe takes. Passed through transparently.
- **Buyer's premium** — a percentage added on top of the hammer price, charged to the buyer. Many real auctions use it. Not in v1; add per-tenant in v2.
- **Hammer price** — the winning bid amount (what "the hammer dropped at"). Not necessarily the final amount paid (buyer's premium + tax + shipping come on top).

## Real-time

- **WS / Basta WebSocket** — `wss://client.api.basta.app/query`. Carries bid state, countdown, item status. See [architecture/realtime-channels.md](../architecture/realtime-channels.md).
- **Realtime / Supabase Realtime** — our Postgres broadcast channels. Carries platform events (lot transitions, questions, bid feed with names).
- **`myBidStatus`** — Basta subscription field per-user: `{ isWinning, maxBid, currentBid }`. Resolved via the bidder token's userId.

## Basta-specific

- **accountId** — Basta's tenant identifier. We use one account across all our houses (ADR-001).
- **Bidder token** — short-lived JWT minted via `createBidderToken`. Authorizes one user to place bids. Carried in `Authorization: Bearer` headers.
- **sale / item** — Basta's words for our auction / lot. The code uses both conventions depending on layer.

---

_Last verified: 2026-04-21_
