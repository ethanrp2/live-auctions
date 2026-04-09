# Live Auctions — Implementation Guide

This document outlines the implementation steps for building the Live Auctions platform. Each step includes what needs to be built, what technologies to use, and what success looks like. Refer to `LIVE_AUCTIONS_PLATFORM_OVERVIEW.md` for full product context and Basta API details.

The implementing agent has access to the **Figma MCP** for all design references and should use those designs as the source of truth for UI implementation.

---

## Stack Decisions

- **Frontend**: Next.js (App Router, TypeScript)
- **Backend**: Node.js / Fastify (TypeScript)
- **Database**: Supabase (managed PostgreSQL with Row-Level Security, Auth, Storage, Realtime)
- **Auth**: Supabase Auth (replaces Clerk/Auth0 — one less dependency)
- **Bidding Engine**: Basta (`docs.basta.app`) — all auction logic, bid processing, real-time bid state
- **Real-time (platform events)**: Supabase Realtime (buyer questions, lot transitions) — replaces the need for standalone Redis pub/sub
- **Audio Streaming**: LiveKit (audio-only, seller → buyers)
- **Payments**: Stripe Connect (per-house connected accounts)
- **SMS**: Twilio
- **Shipping**: Shippo
- **Image Storage**: Supabase Storage (lot images, house branding assets)

---

## Step 1: Project Scaffolding & Multi-Tenant Routing

### What to build
Initialize the Next.js app and Fastify backend. Set up the monorepo structure (or two repos — agent's discretion). Configure the subdomain-based multi-tenant routing that the entire platform depends on.

### How it works
Every request hits Next.js middleware (`middleware.ts`). The middleware reads the `Host` header, extracts the subdomain (e.g. `unsoundrags` from `unsoundrags.liveauctions.com`), queries a tenant lookup (cached), and injects `tenant_id` into the request context via headers. All downstream pages and API routes use this `tenant_id` to scope data. The main domain (no subdomain) serves the platform-level landing/discovery page.

For local development, use `*.localhost:3000` (e.g. `unsoundrags.localhost:3000`).

### Tech
- Next.js App Router with `middleware.ts`
- Fastify server with TypeScript
- Supabase client initialization (server + client side)

### Success
- Hitting `unsoundrags.localhost:3000` resolves to a specific tenant and renders tenant-scoped content.
- Hitting `localhost:3000` (no subdomain) renders the main platform page.
- A request with an unknown subdomain returns a 404 or redirect.
- Fastify server boots and responds to health checks.

---

## Step 2: Database Schema & Row-Level Security

### What to build
Design and migrate the Supabase PostgreSQL schema. Every tenant-scoped table must have a `tenant_id` column with RLS policies enforcing data isolation.

### Core tables (minimum)
- `tenants` — id, slug (subdomain), name, branding config (logo URL, colors, description), stripe_connect_account_id, created_at
- `auctions` — id, tenant_id, basta_sale_id, title, description, status, scheduled_date, created_at
- `lots` — id, tenant_id, auction_id, basta_item_id, title, description, images (array of storage URLs), condition_report, measurements, year, provenance, item_location, shipping_terms, estimate_low, estimate_high, starting_bid, reserve, tags, sort_order, status
- `users` — managed by Supabase Auth, extended with a `profiles` table: id (references auth.users), display_name, avatar_url, shipping_address, stripe_customer_id
- `orders` — id, tenant_id, lot_id, buyer_id, sale_price, payment_status, shipping_status, created_at
- `auction_questions` — id, tenant_id, auction_id, user_id, question_text, created_at

### RLS approach
- All tenant-scoped tables have policies that enforce `tenant_id` matches the requesting context.
- Buyers can read lots/auctions across all tenants (cross-house browsing) but orders are scoped to their own user_id.
- Sellers can only read/write within their own tenant.

### Tech
- Supabase migrations (SQL files or Supabase CLI)
- Supabase RLS policies

### Success
- All tables created with proper foreign keys and indexes.
- RLS policies prevent cross-tenant data access.
- A seller querying lots only sees their own house's lots.
- A buyer can browse lots across houses but only sees their own orders.

---

## Step 3: Authentication & Basta Token Bridge

### What to build
Implement Supabase Auth for user signup/login (email + password minimum). Build the server-side bridge that mints Basta bidder tokens for authenticated users.

### How it works
1. User signs up / logs in via Supabase Auth on the frontend.
2. When a buyer enters a live auction or sets a max bid, the frontend requests a Basta bidder token from your Fastify backend.
3. The backend verifies the Supabase session, then calls Basta's Management API `createBidderToken` mutation with the user's platform `userId` and a TTL.
4. The backend returns the Basta JWT to the client.
5. The client uses this JWT in the `Authorization: Bearer <token>` header for all Basta Client API calls and WebSocket connections.

### Important details
- Basta does not manage users. It accepts any opaque `userId` string. Your platform is the source of truth for identity.
- Bidder tokens have a TTL. For long auctions, implement token refresh logic — detect approaching expiry and request a new token before it lapses.
- Store a mapping of `userId → display_name` so bid events from Basta (which only contain `userId`) can be resolved to usernames for the bid feed UI.

### Tech
- Supabase Auth (client + server SDKs)
- Fastify route: `POST /api/basta-token` — validates Supabase session, calls Basta Management API
- GraphQL client for Basta Management API (`management.api.basta.app`)
- Basta API key auth headers (see `docs.basta.app/api-access`)

### Success
- Users can sign up and log in.
- Authenticated users receive a valid Basta bidder token.
- That token works for placing bids via Basta's Client API.
- Token refresh works before expiry during a long session.

---

## Step 4: House Storefront (Buyer-Facing Pages)

### What to build
The buyer-facing storefront pages — the core browsing and preview experience. Reference the Figma designs via the Figma MCP for pixel-accurate implementation. These pages must be responsive (web + mobile).

### Pages
1. **Auction Preview / House Home** — Hero section with the upcoming/live auction, grid of lots with thumbnails, estimates, and starting prices. SMS subscribe widget (Twilio integration can be stubbed initially). This is the page at `{house}.liveauctions.com`.
2. **Lot Detail / Max Bid** — Individual lot page with image carousel, full metadata (description, condition report, measurements, year, provenance, item location, shipping, estimate), lot navigation tabs across the top, and a max bid input with "SET MAX BID" button. Setting a max bid calls Basta's `bidOnItem` mutation with type `MAX`.
3. **Account Modal** — Overlay with user profile, orders (wins) count, payment method (Stripe), shipping address, logout. Orders sub-view lists wins across all houses with thumbnails and prices.

### Data flow
- Lot content and images come from your Supabase database (the platform's lot CMS data).
- Auction status, current bid state, and bid history come from Basta's Client API (`client.api.basta.app` — public reads, no auth required).
- Max bid placement requires a Basta bidder token (from Step 3).

### Tech
- Next.js App Router pages with server components for initial data fetch
- Supabase client for lot/auction metadata
- GraphQL client for Basta Client API reads
- Supabase Storage for lot images
- Responsive CSS (Tailwind recommended)

### Success
- House storefront renders with correct branding for the resolved tenant.
- Lot grid displays all lots for an upcoming auction with images, estimates, starting prices.
- Lot detail page shows full metadata and image carousel.
- Max bid can be set pre-auction by an authenticated user.
- Account modal shows user profile and order history.
- All pages are responsive and match Figma designs.

---

## Step 5: Seller Lot CMS

### What to build
The seller-facing dashboard for creating auctions and managing lots. This is where house operators add all the content that appears on the buyer-facing storefront.

### Features
- Create a new auction (title, description, scheduled date/time)
- Add lots to an auction with all metadata fields: title, description, images (multi-upload), condition report, measurements, year, provenance, item location, shipping terms, estimate range, starting bid, reserve, tags/brands
- Reorder lots via drag-and-drop (this determines the lot queue order during live auctions — Basta does not handle ordering)
- Edit / delete lots before the auction is published
- Publish auction — this triggers your backend to call Basta's Management API: `createSale` → `createItemForSale` for each lot → `publishSale`

### Important details
- Lot ordering is entirely platform-managed. Store `sort_order` on each lot in your database. Basta items within a sale are unordered.
- When creating items in Basta, store the returned `basta_item_id` on your lot record. This is how you correlate platform lots with Basta items.
- Similarly, store `basta_sale_id` on your auction record after calling `createSale`.
- Images are uploaded to Supabase Storage. Store the public URLs in the `lots.images` array.

### Tech
- Next.js pages (seller-only, behind auth + role check)
- Supabase Storage for image uploads
- Fastify routes for auction/lot CRUD and the Basta publish flow
- GraphQL client for Basta Management API (`createSale`, `createItemForSale`, `publishSale`)
- Drag-and-drop library for lot reordering (e.g. `@dnd-kit/core`)

### Success
- Seller can create an auction, add lots with full metadata and images, reorder them, and publish.
- Publishing successfully creates the sale and all items in Basta, and the auction appears on the buyer-facing storefront.
- Basta IDs are stored and correctly linked to platform records.

---

## Step 6: Live Auction (Buyer-Facing)

### What to build
The real-time live auction experience for buyers. This is the most interactive and latency-sensitive part of the platform. Reference the **Live Auction (Buyer)** Figma screen.

### Features
- Lot queue ribbon at the top showing sold/live/upcoming status for each lot
- Current lot display: images, description, condition report, metadata
- Live bid feed: usernames, timestamps, amounts — updated in real-time
- Current bid amount and countdown timer (anti-snipe, from Basta's `closingTimeCountdown`)
- Bid button showing the next increment amount — calls Basta's `bidOnItem` mutation
- Reserve met/not met indicator
- Audio stream from the seller (LiveKit)
- Viewer count
- "Ask a Question" functionality (buyer submits question visible to the seller console)

### Real-time data flow
- **Bid state, countdown, item status**: Basta WebSocket subscription (`saleActivity` on `wss://client.api.basta.app/query` using `graphql-ws` protocol). Connect with the bidder token in the `connection_init` payload.
- **Lot transitions (which lot is currently live)**: Platform-managed. When the seller advances to the next lot via their console, your backend updates the current lot state. Broadcast this to buyers via Supabase Realtime (subscribe to changes on an `auction_state` table or channel).
- **Buyer questions**: Insert into `auction_questions` table. Supabase Realtime broadcasts to the seller console.
- **Audio**: LiveKit client SDK. Buyer joins a LiveKit room scoped to the auction (room name prefixed by `tenant_id`). Audio-only, receive-only for buyers.

### Important details
- The bid increment shown on the button is determined by Basta's `bidIncrementTable` configured on the sale. Query the sale's increment table and compute the next valid bid amount from the current bid.
- `userId` in Basta bid events must be resolved to display names from your platform's user cache/profiles table.
- Handle Basta bidder token refresh transparently during long auctions.

### Tech
- Next.js client components (heavy client-side interactivity)
- `graphql-ws` package for Basta WebSocket subscription
- Supabase Realtime for platform-level events (lot transitions, buyer questions)
- LiveKit client SDK (`@livekit/components-react` or `livekit-client`)
- Basta Client API for `bidOnItem` mutation

### Success
- Buyer sees real-time bid updates with <1s latency.
- Countdown timer reflects Basta's anti-snipe extensions accurately.
- Bid button places a bid and the UI updates immediately.
- Lot queue ribbon reflects current auction progress (sold/live/upcoming).
- Audio from the seller streams to all connected buyers.
- Buyer can submit a question that appears on the seller console.

---

## Step 7: Seller Live Console

### What to build
The real-time seller control panel for running a live auction. This is the most complex piece — it's the orchestration layer on top of Basta. Reference the **Console (Seller)** Figma screen.

### Features
- **Lot queue sidebar** (left): Ordered list of all lots with thumbnails, titles, and status (sold/live/upcoming). Drag-to-reorder if needed mid-auction.
- **Current lot display** (center): Images, full metadata (description, condition report, measurements, year, provenance, item location, shipping).
- **Seller control panel** (right):
  - Max bids count and highest max bid for the current lot
  - Current bid amount display
  - Countdown timer
  - Bidding increment selector ($50 / $100 / $200 / $250)
  - **SELL** button — accepts the current winning bid, marks the lot as sold, triggers order creation
  - **PASS — NO SALE** button — closes the lot without a sale
  - **NEXT LOT →** button — advances to the next lot in the queue
- **Buyer questions feed** (bottom right): Real-time incoming questions from buyers with usernames and timestamps. Dismissible.
- **Live bid feed** (bottom right): Full bid history for the current lot — usernames, timestamps, amounts.
- **Top bar**: LIVE indicator, viewer count, audio controls (mute/unmute — seller is the audio broadcaster), elapsed time, END AUCTION button.

### Orchestration logic (this is what Basta does NOT handle)
- **Lot sequencing**: Your platform manages which lot is "live." When the seller clicks NEXT LOT, your backend updates the active lot pointer and broadcasts to all buyers via Supabase Realtime.
- **Sell/Pass**: These are platform-level decisions. SELL creates an order record in your database and can trigger a Basta item status update. PASS moves on without an order.
- **Increment selection**: The seller can adjust the increment mid-auction. This is a UI preference that determines what the buyer's bid button shows. It may also update the Basta `bidIncrementTable` for the sale if the Basta API supports mid-sale updates — otherwise manage it platform-side.
- **End Auction**: Closes the entire auction, updates all remaining lots to a terminal state.

### Audio
- Seller is the LiveKit audio publisher. They join the same LiveKit room the buyers are subscribed to, but as a publisher.
- Audio controls (mute/unmute) use the LiveKit client SDK.

### Tech
- Next.js client components (seller-only, behind auth + role check)
- Supabase Realtime for broadcasting lot transitions and receiving buyer questions
- `graphql-ws` for Basta WebSocket subscription (bid state, countdown)
- Basta Client API reads for current bid state
- LiveKit client SDK (publisher mode for seller)
- Fastify routes for sell/pass/next-lot/end-auction actions

### Success
- Seller can run a full auction end-to-end: advance through lots, see live bids, sell or pass on each lot.
- Lot transitions are reflected on the buyer side in real-time.
- Buyer questions appear in the console as they're submitted.
- Audio broadcasts from the seller to all connected buyers.
- SELL creates an order record; PASS moves on cleanly.
- END AUCTION closes everything gracefully.

---

## Step 8: Payments (Stripe Connect)

### What to build
Per-house payment processing using Stripe Connect. Each house has its own Stripe connected account. Buyers pay through the platform, and funds route to the correct house.

### Flow
1. During house onboarding, create a Stripe Connect account for the seller and store the `stripe_connect_account_id` on the tenant record.
2. Buyers save a payment method to their account (Stripe Setup Intent → stored payment method on their Stripe customer).
3. When a lot is sold (SELL from the console), create a Stripe Payment Intent using the buyer's saved payment method and the seller's connected account as the destination.
4. Update the order record with payment status. Handle webhook confirmations from Stripe.

### Tech
- Stripe Node.js SDK
- Stripe Connect (Standard or Express accounts)
- Stripe webhooks for payment confirmation
- Fastify routes for payment processing

### Success
- Sellers complete Stripe Connect onboarding.
- Buyers can save a payment method.
- When a lot sells, payment is processed automatically and routed to the correct house.
- Order records reflect payment status.

---

## Step 9: SMS Notifications (Twilio)

### What to build
SMS alerts for buyers who subscribe to an auction.

### Features
- Subscribe widget on the auction preview page (phone number input).
- Send SMS when: auction is about to start, a lot the buyer has a max bid on is coming up, the buyer wins a lot.

### Tech
- Twilio Node.js SDK
- Fastify routes / background jobs for sending SMS
- Store subscriber phone numbers in a `sms_subscribers` table scoped by auction

### Success
- Buyers can subscribe to an auction via SMS.
- Notifications fire at the correct trigger points.

---

## Step 10: Shipping (Shippo)

### What to build
Post-auction shipping label generation and tracking per house.

### Flow
1. After payment clears, generate a shipping label using Shippo with the seller's return address and buyer's shipping address.
2. Store tracking info on the order record.
3. Buyer can view tracking status in their account/orders.

### Tech
- Shippo Node.js SDK
- Fastify routes for label generation
- Order record updates with tracking info

### Success
- Shipping labels are generated after payment.
- Buyers can see tracking info in their order history.

---

## Implementation Order & Dependencies

Steps should be executed roughly in order, as each builds on the previous:

1. **Project Scaffolding & Routing** — foundation, everything depends on this
2. **Database Schema & RLS** — data layer, needed before any features
3. **Auth & Basta Token Bridge** — needed before any authenticated interactions
4. **House Storefront** — buyer-facing pages, first visible product surface
5. **Seller Lot CMS** — needed to create content that the storefront displays
6. **Live Auction (Buyer)** — the core real-time experience
7. **Seller Console** — the most complex piece, requires Basta integration + real-time platform orchestration
8. **Payments** — can be built in parallel with steps 6-7
9. **SMS** — can be built in parallel with steps 6-7
10. **Shipping** — depends on payments (step 8)

Steps 1-5 form the **static auction experience** (browsing, previewing, CMS). Steps 6-7 form the **live auction experience**. Steps 8-10 are **post-auction fulfillment**.

---

## Notes for the Implementing Agent

- **Figma MCP** is your design source of truth. Reference it for all UI work. The key screens are: Auction Preview / SMS, Lot Preview / Max Bids, Live Auction (Buyer), Account (Buyer), and Console (Seller).
- **Basta docs** at `docs.basta.app` are the source of truth for all bidding engine integration. Key pages: API Overview, Client API, Management API, GraphQL Subscriptions, Webhooks, and the "Create your first auction" walkthrough.
- **Supabase** handles auth, database, storage, and real-time for platform-level events. Basta handles all bidding real-time via its own WebSocket.
- The platform is a **single deployment** serving all tenants. There is no per-tenant infrastructure. Multi-tenancy is achieved through subdomain routing + `tenant_id` scoping in the database.
- All pages must be **responsive** — web and mobile views from the same codebase.
- **Basta's boundary is narrow**: it owns bidding, sale lifecycle, and real-time bid state. Everything else (lot ordering, seller controls, payments, media, notifications, audio, identity) is built by our platform.
