# Live Auctions — Working Notes

> Agent-agnostic progress tracker. Any AI agent (Claude, Codex, etc.) should read this first.
> Overarching plan → see `LIVE_AUCTIONS_PLAN.md`.
> Last updated: 2026-05-03

---

## Branch State

| Branch | Contains |
|---|---|
| `main` | Base scaffold only (3 commits: Initial, backend v1, working storefront) |
| `claude/frosty-feynman-8fd2b6` | M0–M3 fully merged into this — **source of truth for completed work** |
| `claude/festive-curie-b3a813` | **Current active worktree** — fast-forward merged from `frosty-feynman` on 2026-05-03; now contains all M0–M3 + doc consolidation |

**Action needed:** Once this branch's changes are reviewed, merge `claude/festive-curie-b3a813` → `main`.

---

## Milestone Checklist

### ✅ M0: Foundation
- [x] Money-in-cents migration (`step12_money_units_cleanup.sql`)
- [x] `lib/format.ts` rewrite — `formatMoneyCents`, `parseDollarsToCents`
- [x] `.env.example` files (root + backend)
- [x] `scripts/bootstrap.sh` + `pnpm bootstrap`
- [x] `docs/memory/` system seeded

### ✅ M1: Real MAX-bid flow
- [x] `lib/basta/client.ts` — Client API wrapper, error codes, `resolveIncrement`
- [x] `lib/basta/bid-support.ts` — `getBidSupport()` HTTP helper
- [x] Backend `GET /api/basta/bid-support/:lotId`
- [x] `auctions.bid_increment_table` + `closing_time_countdown_ms` columns (`step15`)
- [x] `createItemForSale` now passes `allowedBidTypes: [MAX, NORMAL]`
- [x] `components/storefront/max-bid-section.tsx` — real Basta flow with token refresh retry

### ✅ M2: Webhook ingestion
- [x] `webhook_events` table (`step13`) — idempotency_key PK
- [x] `bids` table (`step14`) — one row per Basta bidId, Realtime published
- [x] `lots.live_status` expanded to include `closing`/`closed` (`step16`)
- [x] `POST /api/webhooks/basta` with idempotency + audit trail
- [x] Handlers: `BidOnItem`, `SaleStatusChanged`, `ItemsStatusChanged`
- [x] Smoke tested with real Basta saleId + itemId

### ✅ M3: Live buyer screen
- [x] `lib/basta/ws.ts` — graphql-ws singleton, bidder-token refresh on connection_init
- [x] `lib/hooks/use-sale-activity.ts` — Basta `saleUpdates` WS subscriber
- [x] `lib/hooks/use-bid-feed.ts` — Supabase Realtime on `bids` with display-name hydration
- [x] `lib/hooks/use-countdown.ts` — 250ms tick countdown
- [x] `lib/basta/place-bid.ts` — high-level bidder with INVALID_TOKEN retry
- [x] `lib/storefront-data-live.ts` — server-side hydration loader
- [x] `backend/src/routes/auction-current-state.ts` — mount-time hydration endpoint
- [x] Route `app/auctions/[auctionId]/live/page.tsx` + `view.tsx`
- [x] Nine `components/live/` components: top-bar, lot-ribbon, lot-hero, bid-history, bid-footer, custom-bid-sheet, max-bid-sheet, countdown-pill, status-banner
- [ ] **DEFERRED**: Browser smoke test against a live OPEN Basta sale
- [ ] **DEFERRED**: Figma visual parity pass (frame 3705:*)

### ✅ M4: Seller live console
- [x] Backend: `PATCH /api/auctions/:auctionId/current-lot` — advance lot, stamp `went_live_at` on first lot
- [x] Backend: `POST /api/auctions/:auctionId/sell` — create order, stamp winner on lot
- [x] Backend: `POST /api/auctions/:auctionId/pass` — stamp lot as passed
- [x] Backend: `POST /api/auctions/:auctionId/end` — end auction
- [x] Backend: `GET /api/auctions/:auctionId/winners` — list winner info (lot + buyer + address + sale price)
- [x] `backend/src/routes/seller/console.ts` — all 5 routes, registered in `backend/src/index.ts`
- [x] Route `app/console/[auctionId]/page.tsx` — seller-only, `is_seller` guard, SSR data fetch
- [x] `lib/hooks/use-console-activity.ts` — Basta WS + Supabase Realtime on bids + auction_questions
- [x] `app/console/[auctionId]/view.tsx` — full desktop console (3-column layout)
- [x] Component: top bar — LIVE indicator, elapsed timer, audio stub, END AUCTION
- [x] Component: lot queue sidebar with sold/live/upcoming/next status chips, red active border
- [x] Component: lot media center — image carousel with arrows + dots, metadata sections
- [x] Component: seller control panel — current bid (Basta WS), countdown pill, increment selector
- [x] Component: SELL/PASS/NEXT LOT action buttons
- [x] Component: buyer questions feed (Supabase Realtime on `auction_questions`, dismiss button)
- [x] Component: live bid feed (Supabase Realtime on `bids`)
- [x] Figma reference: seller console frame `3710:4889` (section `3272:1772`)
- [ ] **DEFERRED**: Browser smoke test against a live OPEN Basta sale

### ✅ M5: Seller lot CMS frontend
- [x] Pages: `/seller/auctions` (list) + `/seller/auctions/[id]` (editor)
- [x] Auction create/edit form (title, description, scheduled date)
- [x] Lot create/edit form with all metadata fields (title, description, condition, measurements, year, provenance, location, shipping, estimates, starting bid, reserve, tags)
- [x] Image upload UI via signed-URL endpoint (`POST /api/seller/auctions/:id/lots/:lotId/images/upload`)
- [x] Up/down arrow reorder (no dnd-kit; uses `PATCH /api/seller/auctions/:id/lots/reorder`)
- [x] Publish button → `POST /api/seller/auctions/:id/publish` → redirect to console

### ✅ M6: Buyer account + Stripe
- [x] `backend/src/lib/stripe.ts` — Stripe SDK initializer
- [x] `POST /api/buyer/setup-intent`, `GET /api/buyer/payment-methods`, `POST /api/buyer/detach-payment-method`
- [x] `POST /api/webhooks/stripe` — `payment_intent.succeeded` stamps `orders.payment_status = 'paid'`
- [x] `components/storefront/account-panel.tsx` — orders list + payment + shipping + logout
- [x] `components/storefront/payment-modal.tsx` — rewritten with real Stripe Elements
- [x] `components/storefront/auth-modal.tsx` — renders AccountPanel when signed in
- [ ] **DEFERRED**: Stripe Connect onboarding for sellers (needs Stripe dashboard setup)
- [ ] **PENDING INSTALL**: `pnpm add -w @stripe/stripe-js @stripe/react-stripe-js` + `cd backend && pnpm add stripe` ✅ done
- [ ] **PENDING ENV VARS**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### ✅ M7: LiveKit audio
- [x] `backend/src/routes/livekit-token.ts` — `POST /api/livekit-token` (publisher for sellers, subscriber for buyers)
- [x] `components/console/livekit-publisher.tsx` — GO LIVE → ON AIR flow with mute toggle
- [x] `components/live/livekit-receiver.tsx` — iOS tap-to-unmute, hidden audio element
- [x] `app/console/[auctionId]/view.tsx` — AudioIcon stub replaced with LiveKitPublisher
- [x] `app/auctions/[auctionId]/live/view.tsx` — LiveKitReceiver added in top bar
- [ ] **PENDING ENV VARS**: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

### ✅ M8: SMS (Twilio)
- [x] Migration: `step17_sms_tenant_id.sql` — adds `tenant_id` to `sms_subscribers` ✅ applied
- [x] `backend/src/lib/sms.ts` — raw-fetch Twilio helper, no-op when `TWILIO_ACCOUNT_SID` empty
- [x] `backend/src/lib/sms-triggers.ts` — `notifyAuctionStarting`, `notifyLotOnDeck`, `notifyWinner`
- [x] `POST /api/seller/auctions/:id/notify/start` + `notify/lot-on-deck`
- [x] `POST /api/buyer/sms-subscribe` — E.164 phone validation, upsert per tenant
- [x] Winner SMS wired into `console.ts` SELL route (fire-and-forget)
- [x] `sms-subscribe.tsx` + `sms-subscribe-sheet.tsx` — pass `tenantId` prop, POST to backend
- [ ] **PENDING ENV VARS**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- [ ] **MANUAL**: Twilio A2P 10DLC compliance registration before sending to US numbers

---

## Pending Manual Actions (deferred)

1. **M1 browser MAX-bid test** — boot `pnpm dev:all`, sign in on `basa.localhost:3000/lots/<lot-id>`, set a max bid, verify Basta accepts it.
2. **M2 ngrok live-fire** — expose backend port via ngrok, configure webhook URL in Basta dashboard, place a real bid to confirm end-to-end.
3. **Basta support email** — send the draft in `docs/memory/risks/basta-support-email-draft.md` to Basta support.
4. **Stripe env vars** — set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in backend `.env`; set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in root `.env.local`. Register Stripe webhook endpoint pointing to `/api/webhooks/stripe`.
5. **LiveKit env vars** — set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in backend `.env`. Create a LiveKit Cloud project at livekit.io.
6. **Twilio env vars** — set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in backend `.env`. Complete A2P 10DLC registration in Twilio console before sending to US numbers.
7. **M3/M4 browser smoke test** — test live buyer screen + seller console against a real open Basta sale. 2026-05-04 API-level BASA live flow passed; still do a human visual pass in a browser with two isolated sessions before launch.

---

## Open Decisions / Questions

| Question | Status |
|---|---|
| Basta `closeItem` / `pauseSale` primitive exists? | Unknown — email pending |
| Basta webhook signature spec | Unknown — using shared-secret stopgap |
| Can bid increment table update on a published sale? | Unknown |
| Seller console: how to "force-close" a lot before its Basta `closingDate`? | Workaround: set very short `closingDate`; real fix needs Basta primitive |

---

## Shipping Approach (MVP decision)

**No Shippo integration.** On SELL:
1. Platform creates an `orders` row with `buyer_id`, `lot_id`, `sale_price`
2. `buyer_id` → `profiles.shipping_address` gives the full address
3. Seller views this via `GET /api/auctions/:auctionId/winners` in the console
4. Seller coordinates fulfillment externally
5. `orders.tracking_info jsonb` is retained for future use
6. `orders.payment_status` and `orders.shipping_status` fields remain for future Stripe + Shippo integration

---

## Architecture Gotchas

- **Lots are ordered by platform, not Basta.** Basta items are unordered within a sale. `lots.sort_order` is the source of truth. `auctions.current_lot_id` tracks which lot the console is displaying.
- **Money = cents everywhere.** DB, UI, Basta API. `formatMoneyCents(cents)` divides by 100 for display. Never store dollars.
- **Auth cookie domain is `.${ROOT_DOMAIN}`** (note the dot prefix). This makes the session cookie shared across all subdomains. Don't change to a single-host domain.
- **Basta bidder token TTL.** Default 60 minutes. The `lib/basta/ws.ts` wrapper refreshes the token on every `connection_init` to handle reconnects. `lib/basta/client.ts` retries once on `INVALID_TOKEN`.
- **Supabase Realtime publication** includes `auctions`, `lots`, `auction_questions`, `bids`. Any table you want Realtime on must be in the publication.
- **Two FK relationships exist between `lots` and `auctions`** (`lots.auction_id` and `auctions.current_lot_id`). PostgREST requires disambiguation: use `auctions!lots_auction_id_fkey` in select embeds.

---

## How to Resume (For Any Agent)

1. Read `LIVE_AUCTIONS_PLAN.md` for product + architecture context.
2. Read this file for current progress.
3. Check `docs/memory/INDEX.md` for deep-dives on specific topics.
4. All milestones M0–M8 complete. Next: browser smoke tests + Stripe/LiveKit/Twilio env var setup.
5. Run `pnpm typecheck` (root) and `pnpm typecheck` (in `backend/`) to verify the build before and after changes.
6. Do NOT restart from scratch — all prior work is in this branch; build on it.

---

## Session Log

| Date | Milestone | Notes |
|---|---|---|
| 2026-04-21 | M0–M2 | Money migration, real MAX bid, webhook ingestion |
| 2026-04-22 | M3 | Live buyer screen with Basta WS + Supabase Realtime |
| 2026-05-03 | Doc consolidation | Merged frosty-feynman → festive-curie; wrote LIVE_AUCTIONS_PLAN.md + WORKING_NOTES.md; updated AGENTS.md; starting M4 |
| 2026-05-03 | M4 complete | Seller console: 5 backend routes (console.ts) + page + hook + full desktop UI (view.tsx). Both typechecks clean. |
| 2026-05-04 | M5–M8 complete | Seller CMS (list + editor), Stripe buyer account + webhook, LiveKit audio, Twilio SMS. Stripe API version fixed. step17 migration applied. Both typechecks clean (0 errors). |
| 2026-05-04 | BASA E2E smoke | Created `Codex E2E BASA 2026-05-04T07-06-09-908Z`, published through seller API, placed a real Basta NORMAL bid as `codex-buyer@example.test`, posted equivalent localhost Basta webhook, sold lot as `codex-basa-seller@example.test`, and verified buyer order `df4cb48c-9e8e-40f1-8291-7a957ae6b69d`. Fixed Basta Client API schema drift: `bidOnItem` now uses `String!` IDs and no longer queries removed `bidType` field on success. |
