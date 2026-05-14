# Live Auctions — Implementation Plan

> Implementation steps, architecture decisions, and progress tracker.
> For product context and user flows, see `LIVE_AUCTIONS_PLATFORM_OVERVIEW.md`.
> Last updated: 2026-05-14

---

## Stack

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
| Shipping | **Not built for MVP** | Record-keeping only; see M-Ship below |

---

## Architecture Decisions

### ADR-001: Single shared Basta account
All tenants share one Basta `accountId`. Tenant isolation is handled at the platform layer — we track `basta_sale_id` per auction and `basta_item_id` per lot.

### ADR-002: Money is integer cents everywhere
All monetary amounts in the DB, UI, and Basta API are integer cents. `lib/format.ts` provides `formatMoneyCents(cents)` for display and `parseDollarsToCents(str)` for storage.

### ADR-003: Auth callback hops through platform root
Magic links and OAuth callbacks point to `http://${ROOT_DOMAIN}/auth/callback?next=<full_tenant_url>`. The callback sets the session cookie with `.${ROOT_DOMAIN}` domain (shared across all subdomains), then redirects to `next`. One entry in Supabase's redirect allow-list.

### ADR-004: Shipping is record-keeping only (MVP)
No Shippo integration. On SELL, the platform records the order. Sellers view winner details (name, shipping address) in the console. `orders.tracking_info jsonb` retained for future use.

---

## Multi-Tenant Routing

Requests hit Next.js middleware (`proxy.ts`). The middleware reads the `Host` header, extracts the subdomain, looks up the tenant (1-min in-memory cache), and injects `x-tenant-id`, `x-tenant-slug`, `x-tenant-name` headers. Unknown subdomain → 404. Main domain → platform landing.

**Local dev:** `*.localhost:3000` (e.g. `basa.localhost:3000`)

---

## Basta Integration Surface

**Management API (backend):**
- `createBidderToken(userId, ttl)`
- `createSale` + `createItemForSale` (with `allowedBidTypes: [MAX, NORMAL]`) + `publishSale`

**Client API (frontend):**
- `bidOnItem(type: MAX)` — max bid pre-auction only
- `bidOnItem(type: NORMAL)` — one-tap live bid + custom amount
- `saleUpdates(saleId)` subscription (WS) — price, countdown, status

**Webhooks (Basta → backend):**
- `BidOnItem` → upserts `bids` table
- `SaleStatusChanged` → updates `auctions.status`, stamps `went_live_at`/`ended_at`
- `ItemsStatusChanged` → updates `lots.live_status`
- Signature verification: using shared-secret header stopgap (Basta spec unknown)

---

## Database Schema

All tenant-scoped tables have `tenant_id` column with RLS. Money = integer cents.

| Table | Purpose |
|---|---|
| `tenants` | House config: slug, name, branding (logo_url, hero_image_url, brand_colors jsonb), fonts |
| `profiles` | Extends auth.users: display_name, avatar_url, shipping_address jsonb, stripe_customer_id, is_seller, tenant_id |
| `auctions` | Auction events: basta_sale_id, status, scheduled_date, current_lot_id, went_live_at, ended_at, bid_increment_table jsonb, closing_time_countdown_ms |
| `lots` | Individual lots: basta_item_id, images[], all metadata fields, sort_order, live_status, winner_user_id, winning_bid_cents, sold_at |
| `bids` | Every Basta bid via webhook: basta_bid_id (unique), amount_cents, max_amount_cents, bid_type, reactive flag, placed_at |
| `orders` | Post-sale records: lot_id, buyer_id, sale_price, payment_status, shipping_status, tracking_info jsonb |
| `auction_questions` | Buyer questions during live: dismissed flag, Supabase Realtime published |
| `sms_subscribers` | Phone numbers subscribed to auction alerts (tenant_id scoped) |
| `webhook_events` | Audit log for inbound Basta webhooks (idempotency_key = PK) |
| `auction_publish_locks` | 5-minute distributed lock preventing duplicate publish |

---

## Architecture Gotchas

- **Lots are ordered by platform, not Basta.** `lots.sort_order` is the source of truth. `auctions.current_lot_id` tracks the active lot pointer.
- **Money = cents everywhere.** DB, UI, Basta API. `formatMoneyCents(cents)` divides by 100 for display.
- **Auth cookie domain is `.${ROOT_DOMAIN}`** (dot-prefixed, shared across all subdomains).
- **Basta bidder token TTL.** Default 60 minutes. `lib/basta/ws.ts` refreshes the token on every `connection_init`. `lib/basta/client.ts` retries once on `INVALID_TOKEN`.
- **Supabase Realtime publication** includes `auctions`, `lots`, `auction_questions`, `bids`.
- **Two FK relationships exist between `lots` and `auctions`** (`lots.auction_id` and `auctions.current_lot_id`). PostgREST requires disambiguation: use `auctions!lots_auction_id_fkey` in select embeds.

---

## Implementation Steps & Progress

### Step 1: Project Scaffolding & Multi-Tenant Routing — DONE
- [x] Next.js App Router with `middleware.ts` / `proxy.ts`
- [x] Fastify server with TypeScript (`backend/`)
- [x] Supabase client initialization (server + client)
- [x] Subdomain-based tenant routing with 1-min in-memory cache

### Step 2: Database Schema & Row-Level Security — DONE
- [x] All tables created with RLS policies
- [x] Money-in-cents migration (`step12_money_units_cleanup.sql`)
- [x] `webhook_events` table (`step13`)
- [x] `bids` table (`step14`)
- [x] `auctions.bid_increment_table` + `closing_time_countdown_ms` (`step15`)
- [x] `lots.live_status` expanded to include `closing`/`closed` (`step16`)
- [x] `sms_subscribers.tenant_id` added (`step17`)
- [x] `tenants.storefront_auction_id` selects the auction displayed on the house page (`step18`)

### Step 3: Authentication & Basta Token Bridge — DONE
- [x] Supabase Auth (email/password + magic links)
- [x] `POST /api/basta-token` — validates Supabase session, calls `createBidderToken`
- [x] Auth callback subdomain hop (`/auth/callback?next=<tenant_url>`)
- [x] `lib/basta/client.ts` — Client API wrapper with `INVALID_TOKEN` retry
- [x] Auth bridge no longer replays stale root-domain refresh tokens; proxy skips public-route auth lookups and clears bad session cookies on recoverable auth errors
- [x] Root login uses explicit buyer/seller mode so seller sign-in routes directly to the seller's house subdomain manager
- [x] Localhost auth bridge only mirrors root sessions when needed, avoiding duplicate refresh-token replay during root→tenant seller redirects

### Step 4: House Storefront (Buyer-Facing Pages) — DONE
- [x] Auction preview / house home page with hero, lot grid, SMS subscribe widget
- [x] Lot detail page with image carousel, full metadata, max bid input
- [x] Storefront lot-card links route to `/lots/[lotId]` for tenant subdomains
- [x] Live auctions redirect tenant lot-detail URLs into `/auctions/[auctionId]/live`
- [x] Open lot-detail pages realtime-redirect into the live room when seller starts
- [x] Account modal with profile, orders, payment method, shipping address
- [x] Tenant storefront sign-in modal now supports buyer-first buyer/seller toggle and routes house sellers into the seller CMS
- [x] All pages responsive (web + mobile)
- [x] Tenant storefront now redirects logged-in house sellers into seller console/CMS instead of buyer storefront
- [x] Storefront home + lot detail now render upcoming/live/ended auction states with sold/passed/unsold outcomes and winner/final-price copy for post-auction lots
- [x] Seller console can choose which auction appears on the tenant storefront
- [x] Seller-facing storefront links can open the public house homepage without redirecting sellers into the CMS

### Step 5: Seller Lot CMS — DONE
- [x] Root `/seller/auctions` house overview; tenant `/seller/auctions` auction list; `/seller/auctions/[id]` editor
- [x] Auction create/edit form (title, description, scheduled date)
- [x] Lot create/edit form with all metadata fields
- [x] Image upload UI via signed-URL endpoint
- [x] Up/down arrow reorder (uses `PATCH /api/seller/auctions/:id/lots/reorder`)
- [x] Publish button → `POST /api/seller/auctions/:id/publish`
- [x] Tenant seller auctions header includes centered BASA logo link back to the house storefront home page
- [x] Tenant seller auctions view routes `← HOUSES` back to the root-domain seller houses dashboard
- [x] Tenant seller auctions view includes a house-branding modal for logo, accent color, and storefront hero image updates
- [x] Seller house cards use absolute tenant storefront URLs so `OPEN STOREFRONT →` lands on the correct subdomain

### Step 6: Live Auction (Buyer-Facing) — DONE
- [x] Route `/auctions/[auctionId]/live`
- [x] Basta WS subscriptions (`saleUpdates`) via `lib/basta/ws.ts` + `use-sale-activity.ts`
- [x] Supabase Realtime bid feed via `use-bid-feed.ts` with display-name hydration
- [x] NORMAL `bidOnItem` wired with token refresh retry
- [x] Live bidding now recovers stale future-dated Basta items by recreating an open Basta sale and retrying once when Basta returns `ITEM_NOT_OPEN`
- [x] Countdown timer (`use-countdown.ts`, 250ms tick)
- [x] Nine components under `components/live/`
- [x] `<AuthModal>` gating for unauthenticated users
- [x] Desktop live-room layout with full-width image + bidding/sidebar panel
- [x] Live bid controls stay paused until seller opens a lot from the console
- [x] Browser smoke test against a live OPEN Basta sale with two buyer bids
- [x] Buyer-live polish: homepage/account nav in top bar, centered question modal, right-side bid-history sheet, backend-unavailable messaging, MAX bid gated to pre-live only
- [ ] **DEFERRED**: Figma visual parity pass

### Step 7: Seller Live Console — DONE
- [x] Backend: `PATCH /api/auctions/:auctionId/current-lot` — advance lot
- [x] Backend: `POST /api/auctions/:auctionId/sell` — create order, stamp winner
- [x] Backend: `POST /api/auctions/:auctionId/pass` — stamp lot as passed
- [x] Backend: `POST /api/auctions/:auctionId/end` — end auction
- [x] Backend: `GET /api/auctions/:auctionId/winners` — list winner info
- [x] Backend: `POST /api/questions` — buyer Q&A with real-time broadcasting
- [x] Buyer question sheet keeps hook order stable when opened/closed
- [x] Route `app/console/[auctionId]/page.tsx` with `is_seller` guard
- [x] `lib/hooks/use-console-activity.ts` — Basta WS + Supabase Realtime on bids + questions
- [x] Full desktop console: 3-column layout with lot queue, lot media, seller controls
- [x] Buyer questions feed with dismiss button
- [x] Live bid feed (Supabase Realtime on `bids`)
- [x] Browser smoke test against a live OPEN Basta sale: start lot, SELL, PASS, next-lot advance
- [x] Console top bar includes a previous-page back control for seller navigation
- [x] Console end-auction action freezes elapsed time, closes active lots, and toggles to restart
- [x] Console buyer watcher count uses Supabase Presence from authenticated live-room buyers

### Step 8: Payments (Stripe) — DONE
- [x] `backend/src/lib/stripe.ts` — Stripe SDK initializer
- [x] `POST /api/buyer/setup-intent`, `GET /api/buyer/payment-methods`, `POST /api/buyer/detach-payment-method`
- [x] `POST /api/webhooks/stripe` — `payment_intent.succeeded` → `orders.payment_status = 'paid'`
- [x] `components/storefront/payment-modal.tsx` — real Stripe Elements
- [ ] **DEFERRED**: Stripe Connect onboarding for sellers
- [ ] **PENDING ENV VARS**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Step 9: SMS Notifications (Twilio) — DONE
- [x] `backend/src/lib/sms.ts` — raw-fetch Twilio helper, no-op when env vars empty
- [x] `backend/src/lib/sms-triggers.ts` — `notifyAuctionStarting`, `notifyLotOnDeck`, `notifyWinner`
- [x] `POST /api/seller/auctions/:id/notify/start` + `notify/lot-on-deck`
- [x] `POST /api/buyer/sms-subscribe` — E.164 phone validation, upsert per tenant
- [x] Winner SMS wired into console SELL route (fire-and-forget)
- [ ] **PENDING ENV VARS**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- [ ] **MANUAL**: Twilio A2P 10DLC compliance registration

### Step 10: LiveKit Audio — DONE
- [x] `backend/src/routes/livekit-token.ts` — `POST /api/livekit-token`
- [x] `components/console/livekit-publisher.tsx` — GO LIVE → ON AIR with mute toggle
- [x] `components/live/livekit-receiver.tsx` — iOS tap-to-unmute, hidden audio element
- [x] LiveKit audio controls hardened: seller mute/unmute uses track publication state; buyer sound on/off pre-unlocks browser playback and handles seller mute state
- [x] Buyer audio subscribe tokens support public listeners; seller publish tokens still require seller auth
- [ ] **PENDING ENV VARS**: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

### Step 11: Shipping — RECORD-KEEPING ONLY (MVP)
- [x] On SELL: `orders` row created with buyer_id + lot_id + sale_price
- [x] `GET /api/auctions/:auctionId/winners` returns buyer shipping address
- [x] `orders.tracking_info jsonb` retained for future Shippo integration

---

## Pending Manual Actions

1. **Stripe env vars** — Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in `backend/.env`; set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local`. Register Stripe webhook endpoint at `/api/webhooks/stripe`.
2. **LiveKit env vars** — Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `backend/.env`. Create a LiveKit Cloud project at livekit.io.
3. **Twilio env vars** — Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `backend/.env`. Complete A2P 10DLC registration before US traffic.
4. **Stripe Connect seller onboarding** — Needs Stripe dashboard setup for connected accounts.
5. **Basta support email** — Ask about `closeItem`/`pauseSale` primitives and webhook signature spec.
6. **Figma visual parity pass** — Compare live buyer screen and console against Figma frames.

---

## Open Questions

| Question | Status |
|---|---|
| Basta `closeItem` / `pauseSale` primitive exists? | Unknown — email pending |
| Basta webhook signature spec | Unknown — using shared-secret stopgap |
| Can bid increment table update on a published sale? | Unknown |
| Seller console: how to "force-close" a lot before Basta `closingDate`? | Workaround: set very short `closingDate`; real fix needs Basta primitive |

---

## Environment Variables

**Root (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_BACKEND_URL` (default: `http://localhost:4000`)
- `NEXT_PUBLIC_ROOT_DOMAIN` (default: `localhost`)
- `NEXT_PUBLIC_BASTA_CLIENT_URL` (default: `https://client.api.basta.app/graphql`)
- `NEXT_PUBLIC_BASTA_WS_URL` (default: `wss://client.api.basta.app/query`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

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
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

---

## How to Resume (For Any Agent)

1. Read `LIVE_AUCTIONS_PLATFORM_OVERVIEW.md` for product context.
2. Read this file for architecture, progress, and what's next.
3. All implementation steps 1-10 are code-complete. Next: env var setup for Stripe/LiveKit/Twilio and Figma visual parity.
4. Run `pnpm typecheck` (root) and `cd backend && pnpm typecheck` before and after changes.
5. Do NOT restart from scratch — build on existing work.
