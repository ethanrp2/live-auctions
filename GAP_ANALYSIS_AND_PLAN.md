# Live Auctions — Gap Analysis + Master Plan

> Audit date: 2026-04-21 · Branch: `claude/frosty-feynman-8fd2b6` · Worktree: `frosty-feynman-8fd2b6`

---

## 0. Executive summary

We have a solid **static preview** of a live auction platform. The buyer storefront (home, lot detail, modals) renders the Figma design beautifully for pre-set tenants, and the seller backend can CRUD a draft auction and push it into Basta via `createSale → createItemForSale → publishSale`. **Everything after "publish" is missing.** There is no seller console, no live-auction buyer screen, no Basta WebSocket integration, no audio, no payments, no shipping, no SMS, and no self-serve way to onboard a new house — today a new tenant requires a developer to write a seed script and hand-edit SQL.

To actually ship a seller and host a real live auction tomorrow, we need a concrete, ordered program of work. This doc splits the work into 8 workstreams (some parallelizable) built around two user journeys:

1. **Onboard a seller** (admin → tenant provisioning → branding → Stripe connect → first auction scheduled)
2. **Host a live sale** (live console, real-time bid engine, buyer live experience, audio, sell/pass, order creation → payment → shipping → notifications)

Estimate: **~8–10 weeks of focused engineering for a single senior full-stack dev**, or 4–5 weeks with two devs splitting frontend-live + backend-payments/webhooks. The highest-risk unknowns are Basta WebSocket behavior under real load and Stripe Connect KYC timing.

---

## 1. What exists today

### Repo layout
- `app/` — Next.js 16 App Router. Routes: `/`, `/lots/[lotId]`, `/seller/onboarding`, `/login`, `/signup`, `/auth/callback`, `/not-found`.
- `backend/` — Fastify + TS. Routes: `/health`, `/api/basta-token`, `/api/seller/onboarding`, `/api/seller/auctions*`, `/api/seller/lots*`, `/api/seller/images*`, `/api/seller/publish`.
- `components/storefront/` — full buyer storefront UI (hero, lot grid, lot detail, image carousel, info panel, ribbon, status bar, SMS subscribe, payment/shipping/auth modals — all **visual-only mocks** that don't wire to Stripe/Twilio).
- `lib/` — Supabase server/client/proxy helpers, tenant lookup (1-min in-mem cache), basta-token client fetcher, storefront data loaders (Supabase first, falls back to hardcoded mock auction), font/color utilities.
- `proxy.ts` — multi-tenant middleware: host header → subdomain → tenant lookup → injects `x-tenant-id`, `x-tenant-slug`, `x-tenant-name`. Protected routes: `/account`, `/console` (neither page exists yet).

### Supabase (project `fkatfnvscuvfejhdblks`)
Tables present:
- `tenants(id, slug, name, description, logo_url, hero_image_url, brand_colors jsonb, font_display, font_mono)` — 3 rows: `demo`, `unsoundrags`, `basa`.
- `profiles(id, display_name, avatar_url, shipping_address jsonb, stripe_customer_id, is_seller, tenant_id, created_at)` — extends auth.users.
- `auctions(id, tenant_id, basta_sale_id, title, description, status [draft|published|live], scheduled_date, current_lot_id, went_live_at, ended_at, created_at)` — 5 rows, one "live" (`basa / Vintage Furniture Archive`).
- `lots(id, tenant_id, auction_id, basta_item_id, title, description, images[], condition_report, measurements, year, provenance, item_location, shipping_terms, estimate_low, estimate_high, starting_bid, reserve, tags[], sort_order, status, live_status, winner_user_id, winning_bid_cents, sold_at, money_in_cents boolean, created_at)` — 24 rows.
- `orders(id, tenant_id, lot_id, buyer_id, sale_price, payment_status, shipping_status, tracking_info jsonb, created_at)` — empty.
- `auction_questions(id, tenant_id, auction_id, user_id, question_text, dismissed, created_at)` — empty.
- `sms_subscribers(id, auction_id, phone_number, created_at)` — empty, **not tenant-scoped**.
- `auction_publish_locks(auction_id, lock_owner, expires_at, created_at)` — 5-minute distributed lock for publish flow.

RLS highlights:
- `tenants` / `auctions` / `lots`: public read.
- `profiles`: user reads/updates own.
- `orders`: buyer reads own; seller reads tenant; **INSERT is `with_check: true` — wide open, relies on backend using service role**.
- `auction_questions`: any authed user INSERT where `user_id = auth.uid()`; seller reads tenant.
- `sms_subscribers`: wide-open INSERT, no SELECT policy.
- Realtime publication includes `auctions`, `lots`, `auction_questions` (migration `live_auction_realtime_publication` + `auction_questions_realtime`).

### Basta integration
Implemented in `backend/src/lib/basta.ts`:
- `createBidderToken(userId, ttl)` — works.
- `createSale`, `createItemForSale`, `publishSale` — works, called from `publish.ts`.

**Not implemented:** item-level operations post-publish (no closeItem, no pause, no update increment table), no webhook receiver, no Client API reads from our backend, no WebSocket subscription.

### Figma coverage
5 top-level sections:
| Section | Desktop | Mobile |
|---|---|---|
| Auction Preview / SMS (Buyer) | 3 | 1 |
| Lot Previews / Max Bids (Buyer) | 5 (incl. Auth, Payment, Address create-profile) | 6 |
| Live Auction (Buyer) | 9 (Winning / Live / Urgent / Custom Bid variants) | 8 (No Bid, Winning, Outbid, Sold, Won, Custom, Questions, All Bids) |
| Account (Buyer) | 8 (Account, Payment list, Address list) | 8 (Orders, Order Confirmed, Order Shipped, Payment Methods, New Payment, Addresses, New Address) |
| Console (Seller) | 5 (Console, Muted, Auction Paused, Confirm Pass) | **0** |

Designs intentionally missing (confirmed by inspection):
- Mobile seller console. (Console is **desktop-only** — our Figma intent.)
- Seller onboarding flow / platform admin tenant-creation UI.
- Lot CMS / "create auction" seller screens (there are no Figma frames for the seller's CRUD pages — only the live console).
- Post-auction seller fulfillment / order management / payouts / analytics.
- Main platform landing page.

---

## 2. Gap analysis — the full picture

### A. Platform admin / tenant provisioning (0% done)
**Missing entirely.** There's no admin UI or API to create a new tenant. Today, a new house requires:
1. A developer writes a seed script (`backend/scripts/seed-<slug>.ts`) following the `seed-basa.ts` pattern.
2. Manual Figma asset export for hero/logo.
3. Direct SQL `INSERT INTO tenants`.
4. Manual subdomain entry.

**What's needed:**
- Admin route/role (distinct from `is_seller`) — currently profiles have no `is_admin` column.
- Tenant creation UI (or at minimum a Fastify `POST /api/admin/tenants` protected endpoint): slug validation (reserved subdomains: `www`, `admin`, `api`, `app`, `main`, `auth`), uniqueness check, branding defaults.
- DNS automation or documented wildcard TLS (`*.liveauctions.com`) — out of app scope but blocks production.
- Tenant editing self-serve by seller (branding, logo, hero, fonts, description).
- Reserved-subdomain blacklist and slug sanitizer.

### B. Seller onboarding (30% done — form exists, flow is shallow)
What exists: `/seller/onboarding` accepts a tenant-scoped single-seller signup, creates a Supabase user, upserts `profiles.is_seller=true`. Enforces "one seller per tenant."

Gaps:
1. **No invite / claim flow** — today, seller onboarding requires the seller to already know their own tenant's subdomain; no admin-created magic-link invite.
2. **No Stripe Connect onboarding** — Stripe Connect account creation is the single biggest dependency for a real auction; Stripe KYC can take hours to days. `tenants.stripe_connect_account_id` doesn't exist yet.
3. **No branding setup wizard** — seller can't upload logo/hero, pick brand color, set font after signup. Today we hand-set those via seed scripts.
4. **No "connect Basta account"** — we're using a single Basta `accountId` in backend env (`config.bastaAccountId`). Either every house sits under our shared Basta account (cheap, simple) or each house needs its own — needs decision.
5. **Email verification is skipped** — `admin.createUser({ email_confirm: true })` bypasses it. Fine for internal, insufficient for production.
6. **Multi-seller per house** — hardcoded "one seller per tenant". Real auction houses have multiple staff.
7. **Role granularity** — no "auctioneer vs. cataloguer vs. owner" roles. Just binary `is_seller`.

### C. Seller lot CMS (60% done — backend solid, frontend missing)
Backend: `POST/GET/PATCH/DELETE /api/seller/auctions`, `...auctions/:id/lots`, `lots/reorder`, `lots/:id/images/signed-upload` + confirm + delete — all sensible, guarded by `requireSeller` and `requireAuctionOwnership`, only mutable while `auction.status === 'draft'`, uses Supabase Storage signed uploads with canonical-URL verification, publish flow has a 5-min distributed lock. **Good bones.**

Gaps:
1. **Zero seller CMS frontend.** `/seller/auctions`, `/seller/auctions/[id]`, `/seller/auctions/[id]/lots/[lotId]/edit` — none exist. The seller literally cannot create a draft auction through a UI today.
2. **No drag-and-drop reorder UI** despite backend endpoint existing. Needs `@dnd-kit/core`.
3. **No CSV/bulk lot import** — a 200-lot auction is a nightmare one-form-at-a-time.
4. **No image multi-upload UI** — backend has the signed-upload endpoint, but no React component consumes it.
5. **No lot preview** from seller's draft view (seller should be able to see what buyer will see before publishing).
6. **No duplicate-auction / template** — for recurring sellers like BASA who run monthly auctions.
7. **Money units ambiguity** — `lots.money_in_cents` boolean exists but is mixed across rows. Per the `project_money_units.md` memory, the convention is **cents everywhere**; enforce this via a migration that sets all rows to `true` and drops the column after backfill, or gate on `money_in_cents` in the UI.
8. **Publish validation is thin** — it checks title + starting_bid but not images, description, estimate, reserve > starting_bid, or mismatched currency. Should hard-fail before calling Basta.
9. **Draft-only mutability is correct, but there's no "edit after publish" flow** — if a seller spots a typo 10 minutes before go-live, they're stuck. Need a "recall from Basta / re-publish" or a whitelist of post-publish-editable fields (description, images).

### D. Buyer experience — static (80% done for preview, 0% done for live)
Preview storefront:
- **What works:** tenant-branded hero, lot grid, lot detail page, image carousel, SMS subscribe widget (visual), max-bid section (visual), auth/payment/shipping modals (visual-only mocks).
- **Gaps:**
  - `MaxBidSection.handleSetMaxBid` only sets local state. **It never calls Basta's `bidOnItem(type: MAX)`**. Every "max bid set" is a lie.
  - `PaymentModal` / `ShippingModal` / `AuthModal` are visual mocks — no Stripe Setup Intent, no Twilio, no Supabase auth calls, just `onComplete()` stubs.
  - `SmsSubscribe` widget — inserts into `sms_subscribers` table? Need to verify (not yet wired based on grep).
  - Account modal from Figma (Account / Orders / Payment / Shipping subviews) not implemented at all.
  - `/account` route doesn't exist (even though `proxy.ts` treats it as protected).
  - No cross-house orders view (Figma shows orders list spanning BASA / Hotel Ceramics / Unsound Rags).
  - Public browse of lots across houses — Figma has main-domain landing showing multiple houses; not implemented.

Live auction buyer screen:
- **100% missing.** There's no `/auctions/[auctionId]/live` route or equivalent. None of the live-state UI (bid button, countdown timer, bid feed, reserve-met indicator, viewer count, "you're winning / outbid / sold / won", ask-question button, audio stream) is built.

### E. Seller live console (0% done) — **the hardest single piece**
Console is the orchestration layer on top of Basta. Figma shows:
- Top bar: "AUCTION MANAGER · THE CHROME HEARTS ARCHIVE", LIVE indicator, viewer count, mic/mute, elapsed time, END AUCTION.
- Left: ordered lot queue (sold/live/next/upcoming), 24 lots scrollable.
- Center: current lot media + metadata.
- Right: max-bids count, current bid, countdown, increment selector ($50/$100/$200/$250), SELL / PASS / NEXT LOT buttons, buyer questions feed, live bid history.
- Confirm Pass modal, Muted state, Auction Paused state.

**Nothing exists.** No route `/console`, no components, no Fastify endpoints for sell/pass/next-lot/pause/end, no Basta WebSocket client, no LiveKit publisher.

### F. Basta real-time integration (0% done)
- No `graphql-ws` WebSocket client either client-side or server-side.
- No subscription to `saleActivity` → can't show live bid state to buyers or seller.
- No subscription filtering by `userId` for per-user "you're winning / outbid" state.
- No webhook receiver for `BidOnItem` / `SaleStatusChanged` / `ItemsStatusChanged` → no way to reliably trigger "lot closed → create order → charge card → generate shipping label" server-side.
- No `bidOnItem` mutation call client-side (max-bid mock is fake).
- No bid-increment-table lookup to compute "next bid" for the buyer's one-tap bid button.
- No token-refresh logic for long auctions (lib/basta-token.ts has a 5-min buffer but the Basta JWT TTL is configured as 60 min — during a 2-hour auction, refresh triggers work, but during WebSocket reconnect nothing re-authenticates the socket).

### G. Payments / Stripe Connect (0% done)
- No Stripe SDK installed in `backend/package.json` or root `package.json`.
- No `tenants.stripe_connect_account_id` column (needs migration).
- No Stripe Setup Intent flow for buyers to save a card (Figma payment modal is a fake input).
- No Payment Intent creation on SELL.
- No Stripe webhook receiver (`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated` for Connect onboarding completion).
- No buyer's saved payment methods management UI.
- No seller's payout / Stripe Express dashboard link.
- No refund flow for disputed wins.

### H. Shipping / Shippo (0% done)
- No Shippo SDK. No `shippo_api_key` tenant config. No label-generation call on payment-success. No tracking-number update to `orders.tracking_info`. No buyer-facing tracking view.

### I. SMS / Twilio (0% done visually, schema-ready)
- `sms_subscribers` table exists (but not tenant-scoped — insert from BASA subdomain can spam Unsound Rags subscribers unless we enforce via backend).
- No Twilio SDK installed. No phone validation (libphonenumber-js missing). No send jobs ("T-5 min before auction", "lot on deck", "you won", "payment succeeded").
- `SmsSubscribe` component is a visual mock.
- Unsubscribe / TCPA compliance (STOP keyword, consent text) not addressed — legal blocker for US SMS.

### J. Audio / LiveKit (0% done)
- No LiveKit SDK. No room-provisioning service. No token mint endpoint. No audio UI for seller (publisher mute/unmute) or buyer (receive-only volume control + muted-by-default with tap-to-unmute on iOS Safari, which is a known gotcha).

### K. Platform landing page / main domain (5% done)
- Root `/` on the main domain currently renders a placeholder "Live Auctions — Real-time auctions for independent auction houses". Figma doesn't show a landing design. Either hide it (redirect to marketing site) or build a minimal discovery page showing live/upcoming auctions across houses.

### L. Observability / ops / security (10% done)
- Fastify logs request bodies (good). No structured OpenTelemetry / Sentry. No rate limiting. Backend CORS allows anything that includes `rootDomain` or `localhost` — tighten.
- No Basta webhook signature verification (docs mention it: `docs.basta.app/webhooks/authenticating-webhook-payloads`).
- Supabase anon key is exposed client-side (correct) but we're not using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` rotation or PR checks.
- RLS on `orders` allows backend insert with `with_check: true` (anyone with service role). That's fine, but UPDATE policies are missing entirely — meaning no one can update an order once inserted. Backend currently has no ability to write `payment_status = 'paid'` through the RLS-scoped client; will have to go through service role. Document this contract.
- **No environment file** (`.env`, `.env.local`) in the worktree. Dev server cannot boot without `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_BACKEND_URL`; backend also needs `SUPABASE_SERVICE_ROLE_KEY`, `BASTA_ACCOUNT_ID`, `BASTA_API_KEY`. No `.env.example` either. This is the first thing any dev will hit.

---

## 3. The full "ship a real seller" journey — step by step

Imagine I'm onboarding **Tom's Rare Watches**. Here's every broken thing on today's code path, in order:

1. I email you asking for an account. → **No admin UI; you SSH into the server and run a seed script.**
2. You pick the slug `tomsrarewatches`. → **No slug validator; `.` in slug breaks routing; no DNS automation.**
3. Tom logs in. → **He has to know to go to `tomsrarewatches.liveauctions.com/seller/onboarding`; no invite email.**
4. Tom wants to brand the house: upload logo, hero image, pick brand color. → **No UI. He emails you PNGs and you edit the Supabase row.**
5. Tom wants to take payments. → **No Stripe Connect; no onboarding link.**
6. Tom creates his first auction. → **No seller CMS UI. He can't reach the `POST /api/seller/auctions` endpoint without a dev tool.**
7. Tom adds 40 lots with images. → **Again, no UI. And no bulk-import.**
8. Tom previews what buyers will see. → **No preview mode; he'd have to publish and hope it looks right.**
9. Tom publishes. → **Works (backend route is solid); calls Basta; sale in `PUBLISHED`.**
10. Tom broadcasts the auction URL. → **Buyers can browse the storefront and set "max bids" — but max bids don't actually hit Basta.**
11. Auction goes live at the scheduled time. → **Basta transitions sale to `OPEN` and items `OPEN`. Neither Tom nor buyers see it, because there's no live console and no live buyer screen.**
12. Tom can't control anything. No sell, no pass, no next-lot. → **Entire console is missing.**
13. Even if we had a console, there's no audio — buyers can't hear Tom. → **LiveKit is unstarted.**
14. Someone wins. → **No order is created because there's no webhook handler. Lot sits as "closed" in Basta, invisible to our DB.**
15. No payment is charged. → **No Stripe.**
16. No shipping label. → **No Shippo.**
17. Buyer doesn't get a "you won" SMS. → **No Twilio.**
18. Buyer opens `/account`. → **Route doesn't exist.**
19. Tom tries to see post-auction reports. → **No seller dashboard.**

**Steps 1–8 are the onboarding gap. Steps 9–19 are the live-sale gap.**

---

## 4. Master plan

Eight workstreams, ordered by dependency. Numbered phases inside each. Where dependencies cross streams, called out explicitly.

### Workstream 1 — Foundations (1 week) 🚨 **must do first**
1.1 Create `.env.example` (root + `backend/`) documenting every var. Include `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_BACKEND_URL`, and backend `SUPABASE_SERVICE_ROLE_KEY`, `BASTA_ACCOUNT_ID`, `BASTA_API_KEY`, `BASTA_BIDDER_TOKEN_TTL_MINUTES`, `BASTA_LOT_DURATION_MS`, plus new ones from the workstreams below.
1.2 Add `pnpm dev:all` smoke-test to README + a bootstrap script that checks env + runs migrations + seeds a demo tenant. Anyone should be able to `git clone && pnpm install && pnpm bootstrap && pnpm dev:all` and hit `demo.localhost:3000`.
1.3 Resolve the `lots.money_in_cents` mixed state — migration to set all rows `true`, backfill cents for false rows, drop column. Update lot CRUD + publish to assume cents. Update `formatMoney` signature to take cents.
1.4 Add `NEXT_PUBLIC_APP_ENV` (dev/staging/prod) and expose platform-level feature flags via Supabase `feature_flags` table (or GrowthBook) — minimum for safe rollout.
1.5 Install Sentry client+server, Fastify rate limiter, Next middleware rate limiter on auth endpoints.

### Workstream 2 — Platform admin + tenant provisioning (3–4 days)
2.1 Migration: add `profiles.is_admin boolean default false`. Add `tenants.stripe_connect_account_id text`, `tenants.stripe_connect_status text`, `tenants.settings jsonb default '{}'::jsonb` for misc future config.
2.2 Backend: `POST /api/admin/tenants` (create), `PATCH /api/admin/tenants/:id`, `GET /api/admin/tenants`. Guard via `requireAdmin` helper. Reject reserved slugs (`www`, `admin`, `app`, `api`, `auth`, `main`, `assets`, `static`, `help`, `mail`, `dashboard`, `console`). Validate slug regex `^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`.
2.3 Frontend: `/admin` route on main domain (protected by `is_admin`). Tenant list + "create tenant" wizard (slug, name, description). Returns a magic-link invite URL the admin emails to the seller.
2.4 Magic-link invite flow: `POST /api/admin/tenants/:id/invite` creates a `seller_invites` row with a secure token, TTL 72h. `/seller/invite/[token]` on the tenant subdomain exchanges the token → renders the existing onboarding form with tenant pre-selected.
2.5 Enforce subdomain cookie scoping — confirm Supabase cookie `.rootdomain` works for cross-subdomain auth hops (cf. memory `project_auth_subdomain_callback.md`).

### Workstream 3 — Seller self-serve branding + settings (2–3 days)
3.1 `/seller/settings` (protected, seller-only). Tabs: Branding, Team, Payouts, Integrations.
3.2 **Branding tab:** upload logo, hero image (Supabase Storage + signed upload, reuse image-endpoint pattern from lots), brand color picker, font dropdown (constrained to the 8 loaded fonts in `layout.tsx`). Description text area. Live preview.
3.3 **Team tab:** list sellers in tenant. "Invite teammate" button (creates new `seller_invites` row for same tenant). Remove `is_seller=true` uniqueness constraint.
3.4 **Payouts tab:** Stripe Connect "Start onboarding" button (→ workstream 6).
3.5 **Integrations tab:** Twilio SMS toggle, Shippo carrier defaults, LiveKit audio settings.

### Workstream 4 — Seller auction/lot CMS frontend (1 week)
4.1 `/seller/auctions` — list of auctions with status badges (draft/published/live/ended). "New auction" CTA.
4.2 `/seller/auctions/new` — form (title, description, scheduled date/time with timezone). Calls `POST /api/seller/auctions`.
4.3 `/seller/auctions/[id]` — lot list with drag-to-reorder (@dnd-kit), "Add lot" CTA, publish button (disabled until all required fields present + at least one lot). Shows Basta sale ID + status once published.
4.4 `/seller/auctions/[id]/lots/new` and `.../lots/[lotId]/edit` — full lot form: title, description, images (multi-upload drag-drop + thumbnail reorder within lot), condition report, measurements, year, provenance, item location, shipping terms, estimate range (low/high), starting bid, reserve, tags. All money inputs in dollars, converted to cents for storage.
4.5 **CSV import** — `POST /api/seller/auctions/:id/lots/bulk` with CSV upload; backend parses and does per-row validation. Template file in docs.
4.6 **Seller preview** — a "View as buyer" button on the auction detail that opens the storefront in an isolated session (seller can see the exact lot grid + detail pages buyers will see pre-publish). Use a dev-only bypass flag + query param.
4.7 Tighten publish validation: reserve ≥ starting_bid, estimate_low ≤ estimate_high, at least 1 image per lot (optional warning), description ≥ 50 chars (warning), scheduled_date ≥ now + 15 min.

### Workstream 5 — Basta real-time + webhook backbone (1.5–2 weeks) 🚨 **blocker for live**
5.1 **Webhook receiver** — Fastify `POST /api/webhooks/basta` that verifies signature per `docs.basta.app/webhooks/authenticating-webhook-payloads` (HMAC secret set in env). Persist every inbound webhook to a `webhook_events` table (idempotencyKey primary key, actionType, payload jsonb, processed_at) before acting — so replays are safe and we have an audit trail.
5.2 Handlers for each actionType:
    - `SaleStatusChanged` — map Basta status (`PUBLISHED→OPEN→CLOSING→CLOSED`) to our `auctions.status`. Set `auctions.went_live_at` when `OPEN`, `ended_at` when `CLOSED`.
    - `ItemsStatusChanged` — update `lots.live_status`, save `saleState.currentBid` if we want to cache it (optional; Basta is canonical).
    - `BidOnItem` — rarely needed server-side (clients get it over WS), but useful for an audit log → insert into a `bids` table (new migration).
5.3 **Order creation on SELL** — when seller hits SELL, backend: (a) queries Basta for item `currentBid` + `newLeader userId`, (b) inserts `orders` row with `buyer_id = userId`, `sale_price = currentBid`, (c) fires Stripe Payment Intent (→ workstream 6), (d) updates `lots.live_status='sold'`, `winner_user_id`, `winning_bid_cents`, `sold_at`.
5.4 **Client-side WebSocket** — `lib/basta/ws.ts` wrapping `graphql-ws`. Hooks: `useSaleActivity(saleId)` returns `{ currentBid, currentLeader, countdownMs, itemStatus }` keyed by item. Handles reconnect with refreshed bidder token. Suspend-resume safe on mobile tab-backgrounding.
5.5 **Bid-increment-table client lookup** — `POST /api/basta/sale/:saleId/next-increment?current=N` → derives next step from the `bidIncrementTable` on the sale (we currently know what we set in `defaultBidIncrementTable`; mirror it server-side).
5.6 Wire **real** max-bid: `MaxBidSection` calls `bidOnItem(saleId, itemId, amount, type: MAX)` with bidder token from `getBastaToken`. Handle success / BidPlacedError errorCodes.
5.7 Per-user subscription (Basta token's `userId` filters the stream): derive "you're winning / outbid / won / sold" state on buyer live screen.

### Workstream 6 — Payments: Stripe Connect + buyer-saved cards (1–1.5 weeks)
6.1 Install `stripe` backend, `@stripe/stripe-js` + `@stripe/react-stripe-js` frontend.
6.2 Migration: confirm `tenants.stripe_connect_account_id` + `stripe_connect_status` from 2.1. Add `profiles.stripe_customer_id` (exists) + `profiles.default_payment_method_id`. Add `orders.stripe_payment_intent_id`, `orders.stripe_charge_id`, `orders.seller_fee_cents`, `orders.platform_fee_cents`.
6.3 **Seller onboarding** — `/seller/settings/payouts` calls `POST /api/seller/stripe/connect-link` → backend creates a Stripe Connect Express account (if missing), returns an AccountLink URL. Webhook `account.updated` → update `stripe_connect_status`.
6.4 **Buyer card save** — `PaymentModal` (replace the mock) uses Stripe Elements + Setup Intent. Store `stripe_customer_id` on profiles, `default_payment_method_id`. Backend route `POST /api/buyer/setup-intent`.
6.5 **Charge on SELL** — from 5.3, backend creates Payment Intent `application_fee_amount = platform_fee_cents`, `transfer_data.destination = tenant.stripe_connect_account_id`, `customer = buyer.stripe_customer_id`, `payment_method = buyer.default_payment_method_id`, `off_session = true`, `confirm = true`.
6.6 Webhook `payment_intent.succeeded` → orders.payment_status='paid'; `payment_intent.payment_failed` → orders.payment_status='failed' + notify seller. Retry policy decision — **ask user**: auto-retry X times or seller manual?
6.7 Platform fee decision — hardcoded 5%? Per-tenant override? **Needs product decision.** Default 5% for MVP.
6.8 Refund button on the seller orders page → Stripe refund API → webhook updates `payment_status='refunded'`.

### Workstream 7 — Live experience: buyer live + seller console (2–3 weeks) 🚨 **the big one**
Depends on 5 (real-time) + 6 (payments for SELL).

7.1 Route `/auctions/[auctionId]/live` (buyer-facing). Renders the Live Auction buyer Figma designs — ribbon, current lot media, bid history, current bid, countdown timer, bid button, reserve-met indicator, "ASK A QUESTION" button, "You're winning / outbid / sold / won" banner. Mobile-first per the 8 mobile Figma frames.
7.2 Buyer bid button: `bidOnItem(amount = current + next_increment, type: MAX)`. Custom bid input flow (Figma "Custom" state).
7.3 "Ask a question" → insert into `auction_questions` (RLS allows it). Supabase Realtime channel `auction:{auctionId}:questions` broadcasts to seller.
7.4 Audio (LiveKit) for buyer — receive-only. Auto-connect on page load, fallback "tap to unmute" for iOS.
7.5 Route `/console` (on tenant subdomain, seller-only). Desktop-only — render a `<MobileUnsupported />` notice on small screens. Layout from Figma `3710:4889`:
   - Top bar with LIVE pulse, viewer count (from LiveKit `room.numParticipants` minus publisher), mic/unmute, elapsed, END AUCTION.
   - Left lot queue (drag-to-reorder works here too, with `live_status` badges).
   - Center current lot render.
   - Right: max-bids count (from Basta query), current bid (from WS), countdown (from WS), increment selector (updates a per-sale `bid_increment_override jsonb` on auction; on SELL/bid it uses this as the step), SELL button (→ `POST /api/seller/auctions/:id/lots/:lotId/sell`), PASS button (→ same with `/pass` — opens Confirm Pass modal from Figma), NEXT LOT button (advances `auctions.current_lot_id`; broadcasts via Supabase Realtime on `auction:{id}:state`).
   - Bottom right: buyer questions feed (subscribe to realtime insert), live bid history (from Basta WS with resolved usernames from profiles cache).
7.6 "Auction Paused" state (Figma `3710:5171`) — seller can pause; we mark `auctions.status='paused'` and gate buyer bids (client-side we hide the bid button; server-side we reject bids — Basta doesn't natively support pause so this is app-level).
7.7 END AUCTION — closes any still-open lots via Basta (sadly Basta has no "close now" API visible in our docs — we may need to set closingDate to now via an update mutation, **verify with Basta docs**). Sets `auctions.status='ended'`, `ended_at=now()`.
7.8 Audio publisher for seller — LiveKit Room SDK, mic permission request.
7.9 `auctions.current_lot_id` logic: seller clicks NEXT LOT → backend validates the next sort_order lot isn't already sold/closed → updates pointer + broadcasts. Buyer UI listens and updates active lot.

### Workstream 8 — Post-auction: shipping, notifications, account, orders (1 week)
8.1 Twilio SMS — backend `SmsService` with templates:
    - Auction T-5min reminder (job scheduled when auction is published — use pg_cron or a Fastify cron at `backend/src/jobs/`).
    - "You won — pay with saved card" after SELL (redundant with auto-charge but useful).
    - "Payment succeeded" + order summary.
    - "Payment failed — update card" with link.
    - "Shipped" with tracking link.
    Implement STOP keyword handling (Twilio webhook → mark subscriber opted-out).
8.2 Shippo — on `payment_intent.succeeded` webhook, call Shippo transactions API with seller return address + buyer shipping address from profiles. Store tracking_number + label URL on orders. Webhook from Shippo for tracking updates → update `orders.shipping_status` + SMS the buyer.
8.3 Tenant-scope `sms_subscribers` (add `tenant_id`, migrate existing to the auction's tenant).
8.4 `/account` route (main domain + subdomain both supported). Implement the Figma Account modal: name/email, Orders (cross-house), Payment Method, Shipping Address, Logout. Orders sub-view per mobile Figma (Orders, Order Confirmed, Order Shipped).
8.5 `/seller/orders` — tenant-scoped orders list for seller, with payment + shipping status, print labels button, refund button.

---

## 5. Suggested execution order (timeline)

Weeks are sequential; items inside a week can parallelize with multiple devs.

| Week | Focus | Outcome |
|---|---|---|
| **1** | WS1 Foundations + WS2 Admin/tenant provisioning | A dev can clone+run. Admin can create a tenant via UI. |
| **2** | WS3 Branding/settings + WS4 Seller CMS frontend part 1 | Seller can log in (via invite), edit branding, create a draft auction, add ~5 lots. |
| **3** | WS4 Seller CMS finish (images, DnD, CSV import, preview) + WS5 Basta webhooks + bids table | Seller can publish; webhooks reliably record every Basta event. Max-bids actually hit Basta. |
| **4** | WS5 finish (WS client, subscriptions, increment lookup) + WS6 start (Stripe Connect onboarding for sellers, Setup Intent for buyers) | Buyers can save cards; sellers complete Connect. Live WS state streaming on a test page. |
| **5** | WS6 finish (charge on sell, refunds, fees) + WS7 start (buyer live route) | Buyers can view live state over WS, place real bids. Payments charge on manual DB update (not yet wired to seller console). |
| **6** | WS7 (seller console — the big block) | End-to-end happy path: seller runs a 3-lot mock auction locally; SELL creates order + charges card. |
| **7** | WS7 finish (audio, questions, pause, end-auction, polish) + WS8 start (SMS + Shippo) | Audio streaming. Post-auction flows trigger. |
| **8** | WS8 finish (account, seller orders, shipping lifecycle) + hardening | Refunds, tracking updates, account page. |
| **9** | End-to-end dress rehearsal with a friendly seller (`basa`) on staging | Real auction, real card, small stakes. Fix what breaks. |
| **10** | Buffer, load test, security review, production launch | Ship. |

---

## 6. Risks & unknowns to resolve early (first 2 weeks)

1. **Basta close-item / pause primitive.** Our docs don't show a manual "close this item now" or "pause sale" mutation. Without it, seller SELL becomes a timing game (we'd have to set closingDate to 1s in future and wait for Basta to close it naturally). **Action: email Basta support / explore the full Management API GraphQL explorer.**
2. **Basta WebSocket behavior across reconnects + token refresh.** Test early with a 2-hour mock auction.
3. **Stripe Connect KYC timing per region.** Tell sellers they need 24–72 hours before their first auction.
4. **LiveKit iOS audio unmute UX.** Known gotcha — plan for a tap-to-start overlay.
5. **Twilio A2P 10DLC registration for US SMS.** ~2 weeks to register a brand + campaign. Start day 1.
6. **Whether each house needs its own Basta account** vs. shared platform account. **Product decision.** Shared is simpler; separate is cleaner commercially. Affects WS2.
7. **Platform fee structure** — flat %? Tiered? Per-transaction minimum? **Product decision.**
8. **Refunds policy + buyer-protection period** — legal + product decision. Affects shipping launch order.

---

## 7. Out of scope for v1 (explicitly deferred)

- Analytics / seller revenue dashboards beyond a basic orders table.
- Buyer-to-buyer chat or social features.
- Absentee bidding beyond max bids (e.g., phone bidder staff-entered bids — a real auction-house need, but v2).
- Multi-currency. USD only, per Basta.
- Live video (audio-only per current product scope).
- Buyer's premium / sales tax automation (Avalara, TaxJar) — start with a single flat buyer's premium configured per tenant; proper tax engine in v2.
- Consignment / estate-management workflows (beyond core lot CMS).
- Mobile seller console (desktop-only by design).

---

## 8. File-by-file starter checklist for Week 1

1. Create `/.env.example` + `/backend/.env.example` with every var documented.
2. Create `/docs/SETUP.md` — step-by-step first-time run.
3. `backend/src/lib/auth.ts`: add `requireAdmin(request, reply)` helper.
4. Migration `step11_admin_and_tenant_extensions.sql`: `profiles.is_admin`, `tenants.stripe_connect_account_id`, `tenants.stripe_connect_status`, `tenants.settings jsonb`, `sms_subscribers.tenant_id`, `seller_invites` table.
5. Migration `step12_money_units_cleanup.sql`: backfill cents, drop `lots.money_in_cents`.
6. Migration `step13_webhook_events.sql`: `webhook_events(idempotency_key pk, action_type, payload jsonb, received_at, processed_at)`.
7. Migration `step14_bids.sql`: `bids(id, auction_id, lot_id, buyer_id, amount_cents, bid_type, basta_bid_id unique, created_at)`.
8. Backend routes skeletons: `routes/admin/tenants.ts`, `routes/seller/settings.ts`, `routes/webhooks/basta.ts`, `routes/webhooks/stripe.ts`.
9. Frontend routes skeletons (minimum bodies + auth gates): `app/admin/page.tsx`, `app/seller/settings/page.tsx`, `app/seller/auctions/page.tsx`, `app/seller/auctions/new/page.tsx`, `app/seller/auctions/[auctionId]/page.tsx`, `app/console/page.tsx`, `app/auctions/[auctionId]/live/page.tsx`, `app/account/page.tsx`.
10. Wire `MaxBidSection` to the real `bidOnItem` (remove the mock).

---

**Verdict:** we have a beautiful static shell and a solid seller-side backend. The hard, risky, *actual live-auction* half of the product doesn't exist yet. The plan above is the thinnest credible path to Tom's first live sale.

---

## Appendix A — Basta primitives deep-dive (answers to the "can we do X?" questions)

Pulled from the Basta reference pack (`skills/basta/references/*.md`) + our local docs. Answers are cross-checked; anything still unverifiable is flagged explicitly so you know what to confirm with Basta support.

### 1. Can we close a single item immediately on seller "SELL"?
**No dedicated `closeItem` mutation is documented.** Basta is time-driven: an item transitions `OPEN → CLOSING → CLOSED` based on `closingDate` + `closingTimeCountdown`. For our live seller console, the **idiomatic pattern is platform-side ordering**:

- Treat "SELL" as our action, not Basta's. Our backend records the winner (from `saleState.newLeader` in the latest WebSocket update or a direct query), creates an `orders` row, marks `lots.live_status='sold'`, and then advances `auctions.current_lot_id` to the next lot.
- We **ignore** the fact that Basta technically still considers the item OPEN until its `closingDate`. When the seller clicks NEXT LOT, our UI hides the sold lot; buyers move on. Late bids that trickle in on the "sold" item still fire webhooks, but we disregard them because our order is already created.
- **Cleaner alternative we should explore with Basta support:** is there an `updateItem` / `updateItemForSale` mutation that lets us set `closingDate` to now? The docs don't list one, but Basta has `updateItem`-style mutations on standalone items. **Flag as open question for Basta support** — important because without a real close, stragglers keep bidding invisibly for the remainder of the scheduled window, which breaks our mental model.

**Implementation guidance:** design the platform so it **doesn't depend** on Basta closing items on command. Every lot gets a sensible `closingDate` (e.g., `now + 120s` at publish, staggered per lot from `auction.scheduled_date`). Seller SELL writes the order immediately from whatever the current leader is. This is the pattern WS 5.3 and WS 7.5 already assume.

### 2. Can we pause a sale mid-auction?
**No documented pause primitive.** Once a sale is `OPEN`, Basta runs the clock. Workarounds:

- **App-level pause:** we set `auctions.status='paused'` in our DB, broadcast over Supabase Realtime, and the buyer live UI hides the bid button / shows "Paused by auctioneer". The seller console won't accept SELL until resumed. Bids sent anyway by a rogue client would still hit Basta — we'd need a backend guard that rejects `/api/basta-token` refreshes during pause, but a bidder with a valid unexpired token can still bid. Not perfect.
- **Stretch the timer:** if we own an `updateItem` mutation (TBC), bump `closingDate` forward by the pause duration across all open lots. Brittle.
- **Kill-switch:** rip the bidder token (server-side revocation). **The docs don't show token revocation.** Another open question.

**Recommendation for v1:** app-level pause only, accept the leakage. Document "pause is best-effort; bids placed in the first ~2s after pause may still be accepted." Good enough for the MVP — real auction houses rarely pause and when they do, it's for minutes not seconds.

### 3. Can `bidIncrementTable` be updated after publish?
**Unknown from the docs.** Neither our local docs nor the skill reference lists an `updateSale` or `updateBidIncrementTable` mutation. The `createSale` mutation accepts it, and the `sale` query returns it, but no update path is documented.

**Recommendation:** **mirror the increment table locally** in the auctions row (`auctions.bid_increment_table jsonb`) at publish time, and let the seller override per-lot via the console increment selector ($50/$100/$200/$250). When placing a `NORMAL` bid from the buyer UI, we compute the next amount ourselves from our local copy. Basta will validate against the stored sale-level rules anyway (Basta returns `BID_TOO_LOW` if the amount doesn't match its rules), so we still want the per-sale default to be "loose enough" at publish to accommodate any mid-auction override the seller makes. Concretely: use a generous default table at createSale (e.g., $25/$50/$100/$250 brackets), and let our app pick which increment to prompt for in the UI.

Confirming with Basta whether `updateSale(bidIncrementTable: {...})` exists is worth one email — if it does, we get a cleaner flow.

### 4. `allowedBidTypes` — what exists, is `type` required?
From the skill reference, there are **two bid types**:
- **`MAX`** — proxy bidding; engine places reactive bids up to user's max.
- **`NORMAL`** — direct bid at a specific amount; must align with increment table; doesn't react.

Both are passed in `bidOnItem(amount, type)` — **`type` is required** (`BidType!`). `allowedBidTypes` on items restricts which types are accepted (e.g., `[MAX]` disables NORMAL bids on that item). If an item allows `[MAX, NORMAL]`, the buyer can pick either.

**Implication for our UI:**
- "Set max bid" (pre-auction) → `type: MAX`.
- "Tap to bid $X" live button → `type: NORMAL` with `amount = current + next_increment`.
- "Custom bid" input (Figma `Custom Bid` state) → either, but `NORMAL` feels more natural (user picks exact amount).

Confirm `allowedBidTypes` on lot creation in `createItemForSale` — our current `publish.ts` **omits `allowedBidTypes`**, which likely defaults to something. Specify it explicitly: `allowedBidTypes: [MAX, NORMAL]` so both UI paths work.

### 5. `BidOnItem.userId` — raw or mapped?
**Raw — it's the exact string you passed to `createBidderToken`.** This is confirmed both in the skill reference and in our local client-api doc ("The userId embedded in the token is used to resolve bids and subscriptions in the user's context").

**Implication:** our `createBidderToken` call passes `user.id` (Supabase auth UUID). So `BidOnItem.userId` in webhooks is a Supabase auth UUID → directly joinable against `profiles.id`. No mapping table needed.

```ts
// Pseudocode in webhook handler:
const { data: profile } = await supabase
  .from('profiles')
  .select('display_name, avatar_url')
  .eq('id', event.data.userId)
  .single();
// That's it. userId = profile.id.
```

### 6. Webhook signature verification — real spec
**Unresolved from the docs.** Both our local doc and the skill reference acknowledge signature verification exists ("See the authenticating webhook payloads documentation") but neither includes the actual HMAC algorithm, header name, or signing secret format. Basta's public page is literally `under construction`.

**What to do:**
1. **Email Basta support** for the spec. Blocker for production (you do not want to process unsigned webhooks from a public endpoint).
2. In the meantime, during dev: (a) allowlist Basta's source IPs if support provides them, (b) require HTTPS, (c) reject any `actionType` we don't recognize, (d) treat `idempotencyKey` as primary key and validate the payload structure. These are hardening not auth — **don't go live without the signature spec.**
3. Plan for the common pattern: `X-Basta-Signature: sha256=<hex>` computed as `HMAC-SHA256(secret, raw_body)`. Our handler should verify on the raw (pre-JSON-parse) body. Fastify needs `addContentTypeParser` to preserve the raw body for signature verification — implement that at route scope for `/api/webhooks/basta` only.

### 7. Subscription filtering — automatic per userId?
**Partially automatic.** Per the skill reference, the Client API exposes:
- `sale(saleId)` / `item(saleId, itemId)` queries — public, no filtering needed.
- `itemUpdates(saleId, itemId)` subscription — returns a `MyBidStatus` field (`isWinning`, `maxBid`) **scoped to the JWT's userId** automatically. No filter arg required.
- `saleUpdates(saleId)` subscription — broadcasts every item in the sale.

So the pattern is: open a WebSocket with the bidder token, subscribe to `itemUpdates` per item or `saleUpdates` for the whole sale. The engine resolves `MyBidStatus` against your token's userId. For the seller console (no user-scoped perspective — seller wants the full picture) either subscribe unauthenticated (if allowed for public reads) or with a dedicated "observer" bidder token for the seller's Supabase user.

**Bid history feed with usernames:** subscriptions return `currentBid`, `bidCount`, etc., but **not the bidder's userId**. The docs don't show a "who just bid" stream on the subscription. So:
- For the live bid feed UI ("@jawad 5 sec ago — $3,250"), rely on the **`BidOnItem` webhook** to push to our own `bids` table via Supabase Realtime to the UI. Our DB broadcasts the display name + amount + timestamp to buyer & seller UIs via Supabase Realtime `bids` table publication.
- This means there's a tiny lag (webhook round-trip) for the bid feed compared to the currentBid number (which updates over Basta WS immediately). Acceptable for auction UX — the big number updates instantly, the "whose bid was it" line catches up within ~500ms.

**Confirm with Basta support:** is there a `bidEvents` or `bidHistory` subscription we missed that includes bidder userId? If yes, we can skip the webhook-based bid feed and reduce latency.

### 8. Server-side next-bid calculation?
**Not documented.** There's no `query nextBid(saleId, itemId)` in the references. We must **mirror `bidIncrementTable` locally** and compute the next valid bid amount on our side (tying back to answer 3).

Implementation:
```ts
// lib/basta/increment.ts
export function nextBid(currentBid: number, table: BidIncrementRule[]): number {
  const rule = table.find(r => currentBid >= r.lowRange && currentBid < r.highRange);
  if (!rule) throw new Error('Bid above increment table range');
  return currentBid + rule.step;
}
```

Store the canonical table on `auctions.bid_increment_table jsonb` at publish time (copy of what we passed to `createSale`). The seller console's increment selector **overrides** this by picking one step for the current lot — our UI computes `currentBid + selectedStep` and sends that as `amount` to `bidOnItem`. If Basta rejects with `BID_TOO_LOW`, fall back to the table-derived next step.

---

## Appendix B — open questions to send Basta support (today)

1. Is there an `updateItem` or `updateSaleItem` mutation that accepts a new `closingDate`?
2. Is there any "close item now" primitive?
3. Is there a pause-sale mechanism, or a way to revoke bidder tokens?
4. Can `bidIncrementTable` be updated on a published/open sale (via `updateSale` or similar)?
5. What is the exact webhook signature algorithm + header name + secret location?
6. What is the Basta source IP range for webhook origin allowlisting?
7. Is there a subscription that includes bidder `userId` in the event stream (for live bid feeds with names)?
8. What's the retry policy + backoff for webhook delivery failures?
9. For multi-tenant platforms (like ours), is the recommendation one Basta account + shared salesId namespace, or one Basta account per tenant?
10. Rate limits: both Management API (publish burst scenarios) and Client API (WebSocket + bidOnItem).

Answers will let us lock down WS5 (real-time backbone) and WS7 (live console) confidently — until then, treat anything marked "**open question**" above as TBD.
