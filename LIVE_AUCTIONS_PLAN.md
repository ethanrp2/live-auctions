# Live Auctions — Master Plan

> Authoritative reference for product context, architecture decisions, and implementation milestones.
> **Working progress tracker → see `WORKING_NOTES.md`.**
> Last updated: 2026-05-03

---

## 1. Product Concept

Live Auctions is a multi-tenant SaaS platform that gives independent auction house operators the infrastructure to run branded, real-time auctions on the web and mobile. Think Shopify, but for live auction sellers. Each seller ("house") gets a branded subdomain (e.g. `unsoundrags.liveauctions.com`) with their own storefront, lot management, and live auction console. Buyers browse, preview, bid, and win across houses through a unified account.

The core bidding engine is **Basta** (`basta.app`) — a headless, API-first auction engine. The platform builds the experience layer on top: storefronts, lot CMS, seller console, buyer accounts, payments, and live audio.

---

## 2. Users

- **Buyers** — Browse houses, preview lots, set max bids, bid live, manage account/payment/shipping, view order history.
- **Sellers (House Operators)** — Create/manage their auction house, curate lots, run live auctions from the console, control lot sequencing, accept/pass on sales.
- **Platform Admin** — Onboards new houses (tenant creation), manages shared infrastructure.

---

## 3. User Flows

### Buyer
1. **Discovery** — Lands on a house subdomain. Browses upcoming auctions and lots.
2. **Preview** — Views lot details (images, description, condition, measurements, provenance, estimate, starting price). Can set a max bid pre-auction.
3. **Live Auction** — Joins a live auction. Sees the current lot, live bid feed, countdown timer (anti-snipe), current price, bid button. Audio stream from the seller is playing.
4. **Post-Auction** — Wins are recorded. Buyer pays via saved payment method. Seller handles fulfillment using the winner info in the console.
5. **Account** — Profile, saved payment method (Stripe), shipping address, order history.

### Seller
1. **House Setup** — Creates house with branding, subdomain, description.
2. **Lot Management** — Adds lots to an upcoming auction: title, description, images, condition report, measurements, year, provenance, item location, shipping terms, estimate, starting bid, reserve, tags/brands. Drag-to-reorder.
3. **Live Console** — Runs the auction in real-time. Left panel: lot queue (ordered). Center: current lot media + details. Right panel: current bid, countdown, increment selector, SELL / PASS / NEXT LOT buttons. Buyer questions feed + live bid history at bottom. Top bar: LIVE indicator, viewer count, audio controls, end auction.
4. **Post-Auction Fulfillment** — Seller views winners per lot (name, shipping address, winning bid amount) directly in the console. Coordinates fulfillment externally; no shipping logistics built into the platform for MVP.

---

## 4. Stack

| Concern | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) | |
| Backend | Fastify (TypeScript) | `backend/` monorepo package |
| Database | Supabase (PostgreSQL + RLS + Auth + Realtime + Storage) | |
| Auth | Supabase Auth (email/password + OAuth) | |
| Bidding engine | Basta (`basta.app`) | Headless; all bid logic |
| Real-time (platform) | Supabase Realtime | Lot transitions, buyer questions, bid feed |
| Audio | LiveKit (audio-only) | Seller broadcasts; buyers receive |
| Payments | Stripe Connect | Per-house connected accounts |
| SMS | Twilio | Auction alerts (A2P 10DLC required) |
| Image storage | Supabase Storage | Lot images, house branding |
| Shipping | **Not built for MVP** | See §8.H |

---

## 5. Architecture Decisions (ADRs)

### ADR-001: Single shared Basta account
All tenants share one Basta `accountId`. Tenant isolation is handled at the platform layer — we track `basta_sale_id` per auction and `basta_item_id` per lot. This avoids per-house Basta onboarding friction.

### ADR-002: Money is integer cents everywhere
All monetary amounts in the DB, UI, and Basta API are integer cents. No decimals. `lib/format.ts` provides `formatMoneyCents(cents)` → display, `parseDollarsToCents(str)` → storage. If you ever see a 100× or 0.01× display value, a conversion is wrong — remove it.

### ADR-003: Auth callback hops through platform root
Magic links and OAuth callbacks point to `http://${ROOT_DOMAIN}/auth/callback?next=<full_tenant_url>`. The callback sets the session cookie with `.${ROOT_DOMAIN}` as the domain (shared across all subdomains), then redirects to `next`. This keeps Supabase's redirect allow-list to one entry.

### ADR-004: Shipping is record-keeping only (MVP)
No shipping logistics integration (Shippo removed from scope). On SELL, the platform records the order (winner, lot, sale price). Sellers view winner details (name, shipping address) in the console and coordinate fulfillment externally. `orders.tracking_info jsonb` is kept for future use.

---

## 6. Basta Integration Boundary

**Basta owns:** Sale lifecycle (`UNPUBLISHED → PUBLISHED → OPEN → CLOSING → CLOSED`), item state machine, bid processing, bid increment rules, reserve prices, anti-snipe countdown, real-time bid state (WebSocket).

**Platform owns:** User identity, lot ordering, seller console UX, all UI, media hosting, payments, shipping records, SMS, audio, multi-tenant routing.

### Auth Bridge Pattern
1. User signs in with Supabase Auth
2. Frontend requests Basta bidder token from `POST /api/basta-token`
3. Backend verifies Supabase session → calls `createBidderToken(userId, ttl)`
4. Client uses the Basta JWT for all Client API calls and WS connections
5. Token refresh: detect approaching expiry, request new token before lapse

### Basta API Surface (as of M3)

**Management API (backend)**
- ✅ `createBidderToken` 
- ✅ `createSale` + `createItemForSale` (with `allowedBidTypes: [MAX, NORMAL]`) + `publishSale`
- ⬜ `sale(id)` query — needed for M4 (SELL: fetch current leader)
- ⬜ `item(saleId, itemId)` query — needed for M4

**Client API (frontend)**
- ✅ `bidOnItem(type: MAX)` — max bid pre-auction and during live
- ✅ `bidOnItem(type: NORMAL)` — one-tap live bid + custom amount
- ✅ `saleUpdates(saleId)` subscription (WS) — price, countdown, status
- ✅ `itemUpdates(saleId, itemId)` subscription (WS)

**Webhooks (Basta → backend)**
- ✅ `BidOnItem` → upserts `bids` table
- ✅ `SaleStatusChanged` → updates `auctions.status`, stamps `went_live_at`/`ended_at`
- ✅ `ItemsStatusChanged` → updates `lots.live_status`
- ⬜ Signature verification (blocked on Basta; using shared-secret header stopgap)

---

## 7. Database Schema (Current)

All tenant-scoped tables have `tenant_id` column with RLS enforcing isolation. Money = integer cents.

| Table | Purpose |
|---|---|
| `tenants` | House config: slug, name, branding (logo_url, hero_image_url, brand_colors jsonb), fonts |
| `profiles` | Extends auth.users: display_name, avatar_url, shipping_address jsonb, stripe_customer_id, is_seller, tenant_id |
| `auctions` | Auction events: basta_sale_id, status, scheduled_date, current_lot_id, went_live_at, ended_at, bid_increment_table jsonb, closing_time_countdown_ms |
| `lots` | Individual lots: basta_item_id, images[], all metadata fields, sort_order, live_status, winner_user_id, winning_bid_cents, sold_at |
| `bids` | Every Basta bid via webhook: basta_bid_id (unique), amount_cents, max_amount_cents, bid_type, reactive flag, placed_at |
| `orders` | Post-sale records: lot_id, buyer_id, sale_price, payment_status, shipping_status, tracking_info jsonb |
| `auction_questions` | Buyer questions during live: dismissed flag, Supabase Realtime published |
| `sms_subscribers` | Phone numbers subscribed to auction alerts |
| `webhook_events` | Audit log for inbound Basta webhooks (idempotency_key = PK) |
| `auction_publish_locks` | 5-minute distributed lock preventing duplicate publish |

**Missing columns (to add during M4):**
- `tenants.stripe_connect_account_id` — needed for Stripe Connect (M6)

---

## 8. Implementation Milestones

### M0: Foundation ✅
Money-in-cents migration, `lib/format.ts` cents API, env examples, bootstrap script, memory system seed.

### M1: Real MAX-bid flow ✅
`lib/basta/client.ts` + `bid-support.ts`, backend `GET /api/basta/bid-support/:lotId`, `max-bid-section.tsx` wired to real Basta `bidOnItem(MAX)` with token refresh retry.

### M2: Webhook ingestion ✅
`POST /api/webhooks/basta` with idempotency, `BidOnItem` → `bids` table, `SaleStatusChanged` → `auctions.status`, `ItemsStatusChanged` → `lots.live_status`. Audit in `webhook_events`.

### M3: Live buyer screen ✅
Route `/auctions/[auctionId]/live`. Basta WS subscriptions (`saleUpdates`, `itemUpdates`) via `lib/basta/ws.ts` + `use-sale-activity.ts`. Supabase Realtime bid feed via `use-bid-feed.ts`. NORMAL `bidOnItem` wired. Nine components under `components/live/`. `<AuthModal>` gating.

### M4: Seller live console 🔲 ← NEXT
Full seller dashboard for running a live auction. Desktop-only (no mobile Figma frames).

**Features:**
- Lot queue sidebar (left) — ordered list, sold/live/upcoming status chips
- Current lot display (center) — images, full metadata
- Seller control panel (right):
  - Max bids count + highest max bid for current lot
  - Current bid amount (live, from Basta WS)
  - Countdown timer (anti-snipe from Basta WS)
  - Increment selector (configurable per auction)
  - **SELL** — accepts winning bid, creates order record, sets `lots.winner_user_id` + `winning_bid_cents`, advances to next lot
  - **PASS — NO SALE** — closes lot without sale, advances
  - **NEXT LOT →** — advances `auctions.current_lot_id`, broadcasts to buyers via Supabase Realtime
- Buyer questions feed (bottom right) — Supabase Realtime on `auction_questions`
- Live bid history (bottom right) — same `bids` Realtime stream as buyer
- Top bar — LIVE indicator, viewer count (placeholder), audio controls (LiveKit stub), elapsed time, END AUCTION

**Backend needed:**
- `PATCH /api/auctions/:auctionId/current-lot` — update `current_lot_id`, broadcast
- `POST /api/auctions/:auctionId/sell` — mark lot sold, create order
- `POST /api/auctions/:auctionId/pass` — mark lot passed
- `POST /api/auctions/:auctionId/end` — end auction, close all remaining lots
- `GET /api/auctions/:auctionId/winners` — list winner info per lot for seller

**Route:** `app/console/[auctionId]/page.tsx` (seller-only, `is_seller` guard)

### M5: Seller lot CMS frontend 🔲
- Auction CRUD UI: `/seller/auctions`, `/seller/auctions/[id]`
- Lot creation form with all metadata fields
- Image upload UI using existing signed-upload endpoint
- Drag-to-reorder via `@dnd-kit/core`
- Publish button wired to existing `POST /api/auctions/:id/publish`

### M6: Buyer account + Stripe 🔲
- Account modal: real orders list (from `orders` table), saved payment method
- Stripe Setup Intent for saving a card (buyers must save card before bidding)
- `tenants.stripe_connect_account_id` migration + Stripe Connect onboarding for sellers
- On SELL: create Stripe Payment Intent, route to seller's connected account
- Stripe webhook receiver: `payment_intent.succeeded` → update `orders.payment_status`

### M7: LiveKit audio 🔲
- Seller: publisher mode, mute/unmute controls
- Buyer: receive-only, tap-to-unmute on iOS Safari
- Backend: LiveKit token mint endpoint, room-per-auction
- Stub is already visual-only in M4 console top bar

### M8: SMS (Twilio) 🔲
- `sms_subscribers` missing `tenant_id` — needs migration to scope properly
- Real SMS: before auction starts, lot on deck, you won
- Twilio A2P 10DLC brand + campaign registration required before US traffic

### Shipping — Record-keeping only (MVP)
No Shippo integration. On SELL, `orders` row is created with buyer_id (linkable to `profiles` for shipping address). Seller views winner details in the console winners view. `orders.tracking_info` retained for future use.

---

## 9. Key Screens (Figma Reference)

| Screen | Description |
|---|---|
| Auction Preview / SMS (Buyer) | House storefront hero, lot grid, SMS subscribe widget |
| Lot Preview / Max Bids (Buyer) | Lot detail, image carousel, full metadata, max bid input |
| Live Auction (Buyer) | Lot queue ribbon, lot media, bid feed, countdown, bid button |
| Account (Buyer) | Orders, payment method, shipping address |
| Console (Seller) | Desktop-only: lot queue, lot media, SELL/PASS/NEXT, questions, bid feed |

---

## 10. Multi-Tenant Routing

Requests hit Next.js middleware (`proxy.ts`). The middleware reads the `Host` header, extracts the subdomain, looks up the tenant (1-min in-memory cache), and injects `x-tenant-id`, `x-tenant-slug`, `x-tenant-name` headers for downstream pages. Unknown subdomain → 404. Main domain → platform landing.

**Local dev:** `*.localhost:3000` (e.g. `basa.localhost:3000`)

---

## 11. Known Risks & Open Questions

| Risk | Status |
|---|---|
| Basta: no `closeItem` / `pauseSale` primitive | Open question to Basta support |
| Basta: webhook signature spec unknown | Using shared-secret header stopgap |
| Basta: can `bidIncrementTable` update on published sale? | Open |
| Stripe Connect KYC can take hours-days | Start onboarding early |
| Twilio A2P 10DLC brand/campaign registration | Required before US SMS traffic |
| LiveKit iOS Safari audio autoplay | Must default muted + tap-to-unmute |

---

## 12. Environment Variables

**Root (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_BACKEND_URL` (default: `http://localhost:4000`)
- `NEXT_PUBLIC_ROOT_DOMAIN` (default: `localhost`)
- `NEXT_PUBLIC_BASTA_CLIENT_URL` (default: `https://client.api.basta.app/graphql`)
- `NEXT_PUBLIC_BASTA_WS_URL` (default: `wss://client.api.basta.app/query`)

**Backend (`backend/.env`):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BASTA_ACCOUNT_ID`
- `BASTA_API_KEY`
- `BASTA_MANAGEMENT_API_URL` (default: `https://management.api.basta.app/graphql`)
- `BASTA_WEBHOOK_SECRET` (optional shared-secret gate)
- `BASTA_BIDDER_TOKEN_TTL_MINUTES` (default: 60)
- `BASTA_LOT_DURATION_MS` (default: 120000)
- `PORT` (default: 4000)
- `ROOT_DOMAIN` (default: `localhost`)
- Future: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
