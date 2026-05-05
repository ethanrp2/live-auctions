# Live Auctions — Platform Overview

## Concept

Live Auctions is a multi-tenant platform that gives independent auction house operators the infrastructure to run branded, real-time auctions on the web and mobile. Think Shopify, but for live auction sellers. Each seller ("house") gets a branded subdomain (e.g. `unsoundrags.liveauctions.com`) with their own storefront, lot management, and live auction console. Buyers browse, preview, bid, and win across houses through a unified account.

The core bidding engine is **Basta** (`basta.app`) — a headless, API-first auction engine. Our platform builds the entire experience layer on top: storefronts, lot CMS, seller console, buyer accounts, payments, shipping, notifications, and live audio.

---

## Users

**Buyers** — Browse houses, preview upcoming auctions and lots, set max bids before an auction starts, bid live during auctions, manage account/payment/shipping, and view order history (wins).

**Sellers (House Operators)** — Create and manage their auction house, curate lots with media/descriptions/metadata, run live auctions from a real-time console, control lot sequencing, accept/pass on sales, and manage fulfillment.

**Platform Admin** — Onboards new houses (tenant creation), manages the main domain and shared infrastructure.

---

## User Flow

### Buyer

1. **Discovery** — Lands on main domain or a house subdomain. Browses upcoming auctions and lots.
2. **Preview** — Views lot details (images, description, condition report, measurements, provenance, estimate, starting price). Can set a max bid pre-auction. Can subscribe to SMS alerts for an auction.
3. **Live Auction** — Joins a live auction. Sees the current lot, live bid feed, countdown timer (anti-snipe), current price, and bid button with next increment. Audio stream from the seller is playing. Lot queue is visible at top showing sold/live/upcoming status.
4. **Post-Auction** — Wins are added to account. Buyer pays via saved payment method. Shipping is handled per-house.
5. **Account** — Profile, saved payment method (Stripe), shipping address, order history across all houses.

### Seller

1. **House Setup** — Creates house with branding, subdomain, description.
2. **Lot Management** — Adds lots to an upcoming auction: title, description, images (carousel), condition report, measurements, year, provenance, item location, shipping terms, estimate, starting bid, reserve, tags/brands.
3. **Live Console** — Runs the auction in real-time. Left panel: lot queue (ordered, drag-to-reorder). Center: current lot media + details. Right panel: seller controls — current bid display, countdown timer, bidding increment selector ($50/$100/$200/$250), SELL / PASS buttons, NEXT LOT button. Below controls: buyer questions feed (real-time) and live bid history with usernames, timestamps, and amounts. Top bar: LIVE indicator, viewer count, audio controls, end auction button.

---

## Key Screens (Figma Reference)

| Screen | Description |
|---|---|
| **Auction Preview / SMS (Buyer)** | House storefront with upcoming auction hero, lot grid with thumbnails/estimates/starting prices, SMS subscribe widget |
| **Lot Preview / Max Bids (Buyer)** | Individual lot detail page — image carousel, full metadata, lot navigation tabs, max bid input with "SET MAX BID" CTA |
| **Live Auction (Buyer)** | Live bidding view — lot queue ribbon, lot media, description/condition, bid history feed, current bid + countdown timer, bid button with next increment |
| **Account (Buyer)** | Account modal overlay — name, email, orders (wins) count, payment method, shipping address, logout. Orders sub-view lists wins across houses with thumbnails and prices |
| **Console (Seller)** | Full seller dashboard during a live auction — lot queue sidebar, lot media + details center, seller control panel with bid display, increment selector, sell/pass/next controls, buyer questions, and live bid feed |

---

## Basta Integration

Basta is the headless bidding engine. It owns:

- **Sale lifecycle** — `UNPUBLISHED → PUBLISHED → OPEN → CLOSING → CLOSED`
- **Item (lot) state machine** — open/closing/closed with anti-snipe countdown extensions (`closingTimeCountdown`)
- **Bid processing** — `BidOnItem` mutation via Client API, supports `MAX` bid type
- **Bid increment rules** — configurable `bidIncrementTable` per sale
- **Reserve prices** — `reserve` field on items
- **Real-time updates** — GraphQL subscriptions over WebSocket (`wss://client.api.basta.app/query`) via `saleActivity` subscription
- **Webhooks** — `BidOnItem`, `SaleStatusChanged`, `ItemsStatusChanged` events for backend workflows

### What Basta does NOT own (our platform must build):

- User identity & auth (Basta accepts any opaque `userId` via `createBidderToken`)
- Lot sequencing / ordering (Basta items are unordered within a sale)
- Manual lot closing, pause, cancel mid-auction
- Seller-facing console and all UI
- Media hosting (images, audio)
- Lot CMS / metadata beyond what Basta stores (condition reports, measurements, provenance, etc.)
- Payments (Stripe Connect)
- Shipping (Shippo)
- SMS notifications (Twilio)
- Buyer questions / Q&A during live auctions
- Audio streaming (LiveKit)
- Multi-tenant routing & house branding

### Auth Pattern

1. User authenticates with Supabase Auth (email/password or magic link)
2. Our backend calls Basta's `createBidderToken` mutation with the platform `userId` and a TTL
3. Client receives the Basta JWT and uses it in the `Authorization` header for all Basta Client API calls and WebSocket connections
4. Basta bid events return the same `userId`, which our platform maps back to display names

---

## Technical Architecture

- **Frontend**: Next.js 16 (App Router, TypeScript, responsive web + mobile views)
- **Backend**: Fastify (TypeScript, `backend/` monorepo package)
- **Database**: Supabase (PostgreSQL + RLS + Auth + Realtime + Storage), every table scoped by `tenant_id`
- **Multi-tenancy**: Single shared deployment. New house = new database rows + subdomain config. No per-tenant infrastructure.
- **Domain routing**: Subdomains per house (e.g. `unsoundrags.liveauctions.com`). Host header → tenant lookup table → scoped data.
- **Real-time**: Basta WebSocket subscriptions for bid state. Supabase Realtime for platform-level events (buyer questions, lot transitions, bid feed).
- **Audio streaming**: LiveKit — audio-only (not video), seller broadcasts to all connected buyers during a live auction.
- **Payments**: Stripe Connect — per-house connected accounts.
- **Shipping**: Record-keeping only for MVP — no Shippo integration. Sellers view winner info in the console.
- **SMS**: Twilio — auction alerts, bid notifications
- **Auth**: Supabase Auth → Basta bidder token bridge

---

## Basta API Quick Reference

| Operation | API | Endpoint |
|---|---|---|
| Create sale, add items, publish | Management API | `management.api.basta.app` (GraphQL, server-side, API key auth) |
| Create bidder token | Management API | `createBidderToken` mutation |
| Query auctions/items (public) | Client API | `client.api.basta.app` (GraphQL, no auth required for reads) |
| Place bid | Client API | `bidOnItem` mutation (requires JWT `Authorization` header) |
| Real-time bid updates | Client API WebSocket | `wss://client.api.basta.app/query` (graphql-ws protocol) |
| Event hooks | Webhooks | `BidOnItem`, `SaleStatusChanged`, `ItemsStatusChanged` |

### Key Basta Concepts

- **Sale** = an auction event containing 1+ items. Has a `closingMethod` (currently only `OVERLAPPING`) and optional `bidIncrementTable` and `closingTimeCountdown`.
- **Item** = a lot within a sale. Has `startingBid`, `reserve`, `openDate`, `closingDate`, and `allowedBidTypes`.
- **closingTimeCountdown** = anti-snipe timer in milliseconds. When a bid is placed during closing, the countdown resets.
- **Bid types** = `MAX` (proxy bidding — system bids on behalf of user up to their max).
