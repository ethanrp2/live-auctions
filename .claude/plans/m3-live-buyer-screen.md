# M3 — Live Buyer Screen Implementation Plan

**Route:** `app/auctions/[auctionId]/live/page.tsx` (new)
**Primary Figma frame:** `3699:747` "Bidding Live (No Bid) - Mobile" (402 x 874, light theme, Berkeley Mono for labels / Inter Display for body copy)
**Scope:** Mobile-first buyer live view. Real-time current bid + countdown via Basta WS, bid history via Supabase Realtime, one-tap NORMAL bid via existing `bidOnItem()` wrapper. M7 items (LiveKit audio, viewer count, buyer-questions Q&A) are stubbed as visual placeholders.

---

## 1. Visual anatomy

All Y coordinates below are within the 874-tall mobile frame (`3699:747`). Every visual region is a top-to-bottom vertical stack; nothing on this screen scrolls horizontally except the lot ribbon.

### 1a. Top bar — `3699:927` (402 x 44, `bg-black`)
Padding `px-16 py-12` (Figma px → Tailwind; we'll use `px-4 py-3`).
- **Left cluster (`3699:928`):** 18px circular tenant avatar (`3699:929` → `imgImage20`) + `JUSTIN` (`3699:930`, Berkeley Mono 12/`tracking-[-0.02em]`, white) + live-person glyph + `240` count (`3699:950` → `Vector` + `3699:942`, colour `#ff5e61`).
- **Center:** `waveform 1` (`3699:965`, 118 x 18 raster — audio activity indicator).
- **Right:** 20px circular menu / user button (`3699:938`).

Data binding:
| Element | Source (M3) | Notes |
|---|---|---|
| Tenant avatar | `tenant.logo_url` | From `getTenantBySlug` (already in `lib/tenant.ts`). |
| Tenant name | `tenant.name.toUpperCase()` | Spec calls this `JUSTIN` — confirmed with user: tenant name, not seller display name. |
| Live count `240` | **M3 placeholder** | Hardcode `—` or omit; real count arrives with LiveKit (M7). Keep the red dot + pill so the layout doesn't shift. |
| Waveform | **M7 placeholder** | Static SVG waveform asset; hide behind `process.env.NEXT_PUBLIC_LIVEKIT_ENABLED` flag, or just always render the static image for now. |
| Menu button | Route to existing account modal | Re-use `AuthModal` trigger from `components/storefront/auth-modal.tsx` (pattern from `lot-info-panel.tsx`). |

### 1b. Lot ribbon — `3699:852` (402 x 60)
Border-bottom `#f3f3f3`. A horizontally-scrolling list of lot chips. Each chip is 38px tall, 22px thumbnail, Berkeley-Mono 12 title, right-aligned status chip:

| Status chip Figma | Style | State |
|---|---|---|
| `3699:856` "SOLD" | `bg-[#848484]` pill, white text, title has `line-through` | `live_status === 'sold'` |
| `3699:861` "LIVE" | `bg-[rgba(255,0,4,0.4)]` pill with 8px red dot (`Ellipse 1`), white text, chip itself has `bg-black` and white title | `live_status === 'live'` |
| `3699:867` "NEXT" | `bg-[#ededed]` pill, black text | `live_status === 'upcoming'` and `sort_order === currentLot.sort_order + 1` (show only the immediate next as NEXT). |

### 1c. Lot hero image — `3699:777` (402 x 240)
- `bg-[#f8f8f8]` fallback, image (`imgFrame15796`) covers the frame (`object-cover`).
- **Overlay elements not in the task prompt but present in the frame** (call out for M3 decisions — all are secondary and can be rendered as static visual noise or omitted):
  - Left/right arrows at y=99 (`3699:779` / `3699:781`) — prev/next image within the single lot's `images[]`.
  - Dot indicator strip at y=212 (`3699:783` → `3699:784…788`) — 4 image thumbnails indicator, active pill `bg-white` 20px wide. This is the **intra-lot image carousel** nav — not a lot carousel.
  - Top-right "ASK A QUESTION" chip (`3699:879`, `bg-[rgba(0,0,0,0.4)]` + 12px Vector icon + Berkeley Mono 12 label). **M7 (buyer questions)** — render as a visible but disabled chip with a subtle opacity so the layout lives, or gate behind `NEXT_PUBLIC_LIVE_QUESTIONS_ENABLED`.

### 1d. Current lot metadata — `3699:789` → `3699:790` (fills remaining column, 402 x 205+)
Padding `p-20` (`p-5`). Two inner blocks with 30px gap.
- **Title block (`3699:791`):**
  - `LOT 01 OF 24` — Berkeley Mono 14 `text-[#5e5e5e] tracking-[-0.02em]` (`3699:793`).
  - Lot title — Inter Display 26, black (`3699:794`).
  - Pills row (`3699:795`): `CHROME HEARTS` (brand), `STARTS: $200`, `EST: $5,000` — Berkeley Mono 14, `bg-[#ededed]`, `rounded-[4px]`, `px-2 py-1`.
- **Details block (`3699:802`):**
  - `DESCRIPTION` (label `#5e5e5e` Berkeley Mono 12 + body Inter Display 14 black).
  - `CONDITION REPORT` same pattern.
  - `MEASUREMENTS` same pattern, body allows line breaks.
  - Four `label ↔ value` rows inside `3699:812` (`YEAR`, `PROVENANCE`, `ITEM LOCATION`, `SHIPPING`) — both sides Berkeley Mono 12, `justify-between`.

### 1e. Bid history — `3699:883` (402 x 108)
Padding `p-20`, border-bottom `#f3f3f3`.
- **Header (`3699:884`):** left `bid History` (Berkeley Mono 12 uppercase black), right `view all (40)` (Berkeley Mono 12 `#5e5e5e` underline).
- **Row 1 (`3699:888`, opacity 100):** 12px avatar circle + `@JAWAD` + `5 SEC AGO` (relative time) · right-aligned `$3,250.00`.
- **Row 2 (`3699:894`, opacity 40):** `@AP` + `30 SEC AGO` · `$3,000.00` — older entries are faded.
- **Fade mask (`3699:912`):** white→transparent gradient covering the top 58px so more rows can sit underneath but fade out — preserves room for the "VIEW ALL" sheet affordance.

Only the two most-recent rows render in the collapsed view.

### 1f. Sticky bid footer — `3699:913` (402 x 217)
`bg-white`, padding `p-20`, `gap-20` (`gap-5`) between the three rows.
- **Row 1 (`3699:914`):**
  - Left (`3699:915`): `CURRENT BID` (Berkeley Mono 12 `#5e5e5e`) over `$3,250.00` (Inter Display 40 `font-medium` black).
  - Right (`3699:918` → `3699:919`): countdown pill `bg-[#ededed]` `rounded-[6px]` `px-2 py-1` with clock Vector + `00:02:30` (Berkeley Mono 16 black).
- **Row 2 — bid CTA (`3699:922`):** 50px tall, `bg-black` `rounded-[2px]`, white Berkeley Mono 14 uppercase `BID $3,750.00` (= current + next-increment).
- **Row 3 (`3699:924`):** `By bidding you agree to the Terms of Sale.` Inter Display 12 `#5e5e5e`, centered.

On mobile the footer is `sticky bottom-0 z-10` with `safe-area-inset-bottom` padding; on desktop/tablet we let it sit inline (design is mobile-native, no desktop footer required).

---

## 2. Component tree

### 2a. New files (under `components/live/*`)

```
components/live/
  live-auction-screen.tsx      # client orchestrator, owns state machine + subs
  live-top-bar.tsx             # node 3699:927
  live-lot-ribbon.tsx          # wraps storefront LotRibbon w/ live_status chip
  live-lot-hero.tsx            # node 3699:777 (image + question chip placeholder)
  live-bid-history.tsx         # node 3699:883 (collapsed 2-row view + view-all stub)
  live-bid-footer.tsx          # node 3699:913 sticky footer — the ONE-TAP CTA
  live-status-banner.tsx       # winning / outbid / sold / paused banners (node 3705:*)
  live-custom-bid-sheet.tsx    # bottom sheet for arbitrary-amount bid input
  countdown-pill.tsx           # small, reusable — node 3699:918
```

### 2b. Existing components — reuse decisions

| Existing | Path | Decision |
|---|---|---|
| `LotRibbon` | `components/storefront/lot-ribbon.tsx` | **Fork, don't reuse directly.** Current ribbon only marks an `isCurrent` lot with a black border; live design needs three distinct status chips (SOLD / LIVE / NEXT), uses black fill on the LIVE chip, and adds line-through to SOLD titles. Forking as `live-lot-ribbon.tsx` avoids polluting the preview-screen ribbon with auction-state logic. Ribbon data shape stays: `LotRibbonItem` extended with `live_status: 'sold' \| 'live' \| 'upcoming'`. |
| `LotInfo` | `components/storefront/lot-info.tsx` | **Reuse as-is.** Renders LOT XX OF YY, title, pills, description, condition report, measurements, and the year/provenance/location/shipping rows. Matches `3699:789` 1:1. No changes needed. |
| `LotInfoPanel` | `components/storefront/lot-info-panel.tsx` | **Do not reuse.** It composes `AuctionStatusBar + LotInfo + MaxBidSection` for the preview screen; live screen has a completely different footer. Reuse `LotInfo` directly inside `live-auction-screen.tsx`. |
| `ImageCarousel` | `components/storefront/image-carousel.tsx` | **Reuse with a new `heightClass` prop** (or use existing responsive heights). Current height is `h-[300px] lg:h-[calc(100vh-110px)]`; live hero is 240px fixed (`3699:777`). Smallest change: pass a `heightClass="h-60"` prop and branch inside, rather than fork. |
| `MaxBidSection` | `components/storefront/max-bid-section.tsx` | **Do not reuse on-screen.** Live footer is the one-tap NORMAL flow, not the typed MAX flow. But **the max-bid flow must remain reachable**: a secondary link in the footer (`SET MAX BID` text button under the primary CTA, or inside an overflow action) opens a bottom-sheet that embeds `<MaxBidSection>` unchanged. This is the cleanest reuse because the component is self-contained and already drives auth/payment modal chaining. |
| `AuthModal`, `PaymentModal`, `ShippingModal` | `components/storefront/` | **Reuse.** The live bid footer needs the same auth-then-payment-then-shipping modal chain before a first bid. Lift the modal-state reducer currently inside `LotInfoPanel` into `live-auction-screen.tsx` with the same `ModalState = 'none' \| 'auth' \| 'payment' \| 'shipping'` union. |
| `auction-status-bar.tsx` | storefront | **Do not reuse.** That's the "live Feb 15 at 7pm / get alerted" preview bar. Live screen replaces it with `LiveTopBar`. |
| `sms-subscribe-sheet.tsx` | storefront | **Not needed.** SMS subscribe belongs to the pre-auction Preview screen. |

### 2c. Component props (authoritative signatures for implementation)

```ts
// live-auction-screen.tsx — default export, client component
export interface LiveAuctionScreenProps {
  tenant: Tenant;                        // from lib/tenant.ts
  auction: {
    id: string;                          // our auction UUID
    bastaSaleId: string;                 // Basta saleId — needed for WS sub
    title: string;
    lots: LiveRibbonLot[];               // ordered by sort_order
    currentLotId: string;                // lot with live_status === 'live', or the first upcoming
  };
  currentLot: StorefrontLotDetail & {
    bastaItemId: string;                 // needed for WS filter + bidOnItem
    liveStatus: 'upcoming' | 'live' | 'sold';
    soldPriceCents?: number | null;
    winnerUserId?: string | null;
    winnerHandle?: string | null;
  };
  viewer: {
    userId: string | null;               // our platform user id (from Supabase)
    handle: string | null;               // display name (@handle) for bid-row rendering
    isAuthenticated: boolean;
  };
}

// live-lot-ribbon.tsx
export interface LiveRibbonLot extends LotRibbonItem {
  liveStatus: 'upcoming' | 'live' | 'sold';
}
export interface LiveLotRibbonProps {
  lots: LiveRibbonLot[];
  currentLotId: string;                  // drives which chip is LIVE
  nextLotId: string | null;              // drives which chip is NEXT (only one)
  onLotClick?: (lotId: string) => void;  // optional — default Links like the preview ribbon
}

// live-top-bar.tsx
export interface LiveTopBarProps {
  tenantName: string;
  tenantLogoUrl: string | null;
  viewerCount: number | null;            // null → hide count, keep waveform
  onMenu: () => void;
}

// live-lot-hero.tsx
export interface LiveLotHeroProps {
  images: string[];
  title: string;
  onAskQuestion?: () => void;            // M7; pass undefined to disable chip
}

// live-bid-history.tsx
export interface BidFeedEntry {
  id: string;
  userId: string;
  handle: string;                        // already resolved platform-side
  amountCents: number;
  placedAt: string;                      // ISO
  isCurrentUser: boolean;
}
export interface LiveBidHistoryProps {
  bids: BidFeedEntry[];                  // newest first; component renders first 2
  totalCount: number;                    // drives "VIEW ALL (40)"
  onViewAll: () => void;
}

// live-bid-footer.tsx
export interface LiveBidFooterProps {
  currentBidCents: number | null;        // null before first bid → show starting bid
  nextIncrementBidCents: number | null;  // current + resolved increment step
  countdownMs: number | null;            // null → lot not closing; hide pill
  viewerState:
    | { kind: 'idle' }                   // not your turn, nobody is winning you
    | { kind: 'winning' }                // you are high bidder
    | { kind: 'outbid' }                 // you bid and got outbid
    | { kind: 'sold'; winnerHandle: string; winningPriceCents: number }
    | { kind: 'paused' };
  onOneTapBid: () => Promise<void>;      // NORMAL bid at nextIncrementBidCents
  onOpenCustomBid: () => void;           // opens live-custom-bid-sheet
  onOpenMaxBid: () => void;              // opens bottom sheet wrapping MaxBidSection
  isPlacing: boolean;                    // disables CTA, shows "PLACING BID…"
  lastError: string | null;              // rendered in small red text under CTA
}

// live-status-banner.tsx
export type LiveBannerKind = 'winning' | 'outbid' | 'sold' | 'paused';
export interface LiveStatusBannerProps {
  kind: LiveBannerKind;
  winnerHandle?: string;
  winningPriceCents?: number;
}

// live-custom-bid-sheet.tsx
export interface LiveCustomBidSheetProps {
  isOpen: boolean;
  onClose: () => void;
  lotId: string;
  startingBidCents: number | null;
  minNextBidCents: number | null;        // currentBid + increment, used as placeholder
  onSubmitted: (amountCents: number) => void;
}
```

### 2d. Tree (runtime composition)

```
<LiveAuctionPage /* RSC */>
  └─ <LiveAuctionScreen> /* client */
      ├─ <LiveTopBar />
      ├─ <LiveLotRibbon />
      ├─ <LiveLotHero />         // uses <ImageCarousel heightClass="h-60" />
      ├─ <LiveStatusBanner />    // conditional (winning / outbid / sold / paused)
      ├─ <LotInfo />             // REUSED from storefront
      ├─ <LiveBidHistory />
      ├─ <LiveBidFooter />       // sticky
      ├─ <LiveCustomBidSheet />  // modal
      ├─ <MaxBidSheet>           // modal wrapping <MaxBidSection>
      ├─ <AuthModal />
      ├─ <PaymentModal />
      └─ <ShippingModal />
```

---

## 3. Data flow

### 3a. Server-side (RSC — `app/auctions/[auctionId]/live/page.tsx`)

Next.js 16 convention — `params` is a Promise; follow `app/lots/[lotId]/page.tsx` exactly:

```
async function LiveAuctionPage({ params }: { params: Promise<{ auctionId: string }> })
```

Steps:
1. `const { auctionId } = await params`.
2. Resolve tenant via `x-tenant-slug` header → `getTenantBySlug(supabase, slug)`. `notFound()` on miss.
3. `supabase.auth.getUser()` for the viewer (non-blocking — unauthenticated viewers can watch).
4. Fetch the auction row scoped to `tenant.id`: `auctions.id, title, basta_sale_id, status` where `id = auctionId` and `tenant_id = tenant.id`. `notFound()` if missing or if `status != 'live'` (see §6 open question on "not yet live").
5. Fetch all lots for the auction ordered by `sort_order, created_at` with enough columns to populate the ribbon **and** the currently-live lot's full detail. Two queries is cleanest: one lightweight ribbon query + one full-detail query filtered by `live_status = 'live'` (or `sort_order = 0` fallback).
6. Resolve `bastaItemId` on the live lot (it's already on the `lots` table from M1).
7. Resolve viewer `handle` from `profiles` table (or fall back to `@user-{id.slice(0,6)}`).
8. Pass a fully-formed `LiveAuctionScreenProps` into `<LiveAuctionScreen>` (client).

### 3b. Client-side real-time plumbing

Two subscriptions, both owned by `<LiveAuctionScreen>`:

#### `useSaleActivity(bastaSaleId)` — Basta WebSocket
**Source:** `wss://client.api.basta.app/query`, `graphql-ws` protocol (already a dep, see `package.json`). Operation is the `saleActivity` (a.k.a. `itemUpdates` / `saleUpdates`) subscription.

**Wire payload shape (discriminated union, narrowed per `__typename`):**
```ts
export type SaleActivityEvent =
  | {
      kind: 'itemBid';
      itemId: string;
      currentBidCents: number;
      bidderUserId: string;          // Basta echoes our opaque userId
      closingTimeMs: number | null;  // anti-snipe extension
    }
  | {
      kind: 'itemStatus';
      itemId: string;
      status: 'OPEN' | 'CLOSING' | 'CLOSED';
      soldPriceCents: number | null;
      winnerUserId: string | null;
    }
  | {
      kind: 'saleStatus';
      status: 'OPEN' | 'CLOSING' | 'CLOSED';
    };

export interface UseSaleActivityResult {
  currentBidCents: number | null;
  countdownMs: number | null;        // derived: closingTimeMs - now(), re-ticked via setInterval
  itemStatus: 'OPEN' | 'CLOSING' | 'CLOSED' | null;
  leaderUserId: string | null;
  soldPriceCents: number | null;
  winnerUserId: string | null;
  connected: boolean;
  error: string | null;
}
```

Hook responsibilities (implementation concern for the parallel-track author; plan mentions them so we don't accidentally re-do them here):
- Mint a Basta bidder token via `getBastaToken(session?.access_token)` (anonymous bidder tokens for viewers who haven't signed in — confirm in open question §6).
- Open one WS connection per `saleId`; filter events client-side by `currentLot.bastaItemId`.
- Reconnect with exp-backoff on disconnect; on foreground resume (`document.visibilitychange` → `visible`) reconnect immediately.
- Derive a 1-Hz countdown tick from `closingTimeMs` so the pill counts down between WS events.

#### `useBidFeed(auctionId, lotId)` — Supabase Realtime
**Source:** `bids` table (M2), `postgres_changes` channel filtered by `auction_id=eq.${auctionId}` and `lot_id=eq.${lotId}`.

**Payload shape:**
```ts
export interface BidRow {
  id: string;
  auction_id: string;
  lot_id: string;
  user_id: string;
  amount_cents: number;
  basta_bid_type: 'MAX' | 'NORMAL';
  created_at: string;
}

export interface UseBidFeedResult {
  bids: BidFeedEntry[];         // newest-first, hydrated with @handle from profiles
  total: number;                 // server-reported total for "VIEW ALL (N)"
  connected: boolean;
}
```

- Initial fetch: top 50 via REST/`from().select()` ordered by `created_at desc`.
- Live: on INSERT, prepend to the list, resolve `handle` from a local profile cache (fall back to `@user-{id.slice(0,6)}` while the profile fetch flies, then fill in).
- On `lotId` change (ribbon switches current lot), unsubscribe + resubscribe.

### 3c. Mapping hooks → UI

| UI region | Field consumed | Hook |
|---|---|---|
| `LiveTopBar.viewerCount` | placeholder — show `—` | — (M7) |
| `LiveLotRibbon.lots[].liveStatus` | auction row's per-lot `live_status` column | RSC initial + `useSaleActivity().itemStatus` promotes the next lot to LIVE when an `itemStatus → CLOSED` arrives. |
| `LiveBidFooter.currentBidCents` | `currentBidCents` | `useSaleActivity` (authoritative). Seed with RSC value. |
| `LiveBidFooter.nextIncrementBidCents` | `currentBidCents + resolveIncrement(currentBidCents, incrementTable)` | Increment table from `fetchBidSupport(lotId)` (already exists in `lib/basta/bid-support.ts`), fetched once on mount. |
| `LiveBidFooter.countdownMs` | `countdownMs` | `useSaleActivity` + local 1-Hz tick. |
| `LiveBidFooter.viewerState` | derived: `leaderUserId === viewer.userId` → `winning`; last user bid exists and leader != viewer → `outbid`; `itemStatus === 'CLOSED'` → `sold`; `saleStatus === 'PAUSED'` (TBD) → `paused` | pure selector inside `<LiveAuctionScreen>`. |
| `LiveBidHistory.bids` | `bids` | `useBidFeed`. |
| `LiveBidHistory.totalCount` | `total` | `useBidFeed`. |
| `LiveStatusBanner.kind` | same selector as `viewerState` | `<LiveAuctionScreen>`. |

---

## 4. State variants

Page-level state machine owned by `<LiveAuctionScreen>`:

```
idle  ──onOneTapBid──▶  bidding
bidding  ──success (normal bid accepted)──▶  success
bidding  ──error──▶  idle  (lastError populated)
success  ──new bid from another user outbids us──▶  outbid
idle/success  ──new bid from us at or above current──▶  winning
winning/outbid  ──itemStatus CLOSED──▶  sold-terminal (any buyer) ──or── sold-winner (we won)
paused  — any state can enter via saleStatus transition (ADR-TBD)
```

`idle` / `bidding` / `success` / `outbid` are mutually exclusive; `winning` is a derived *indicator*, not a distinct control flow state. That lets us keep a single `BidPlacementState` enum driving CTA disabling and a separate `viewerState` driving banner/label.

| State | Visual delta vs baseline `3699:747` | Detection |
|---|---|---|
| **No bids yet (baseline)** | `CURRENT BID` shows the starting bid in the small label area, primary CTA reads `BID $<starting>`. | `currentBidCents == null` after RSC seed + WS hydration. |
| **Live, someone else leading** | Baseline; no banner. | `leaderUserId && leaderUserId !== viewer.userId`. |
| **You're Winning** (variant pulled from `3705:*`) | Green (or brand-accent) banner between hero and `LotInfo`: `YOU'RE WINNING @ $3,250`. Primary CTA stays enabled (you can still raise your own bid — spec TBD, see §6). | `leaderUserId === viewer.userId`. |
| **You're Outbid** (`3705:*`) | Red/black banner: `YOU'RE OUTBID — BID $3,750 TO LEAD`. CTA label changes to highlight urgency (`BID $3,750 NOW`) — keep same handler. | The viewer has placed at least one bid on this lot AND `leaderUserId !== viewer.userId`. Tracked via `hasBidOnThisLot` in local state (flip to true on success). |
| **SOLD — terminal** (`3705:*`) | Banner `SOLD — $X to @WINNER`. Countdown pill + CTA row are replaced by a disabled `SOLD` block (single line, no button). Bid history remains visible. Ribbon chip for this lot flips to SOLD. | `itemStatus === 'CLOSED'`. |
| **SOLD — you won** | Same banner, additionally show `CONGRATS — PROCEED TO CHECKOUT` CTA (routes to account/orders). | `itemStatus === 'CLOSED' && winnerUserId === viewer.userId`. |
| **Custom-bid input** (`3705:*`) | Bottom sheet overlays the footer; content is an input field + `CONFIRM BID` CTA. | User tapped a "custom amount" affordance — see §4a for which affordance. |
| **Set max bid** | Bottom sheet overlays; inner content is `<MaxBidSection>` unchanged (it already handles its own auth/payment chain via callbacks). | User tapped `SET MAX BID` link under primary CTA. |
| **Auction paused** (`3705:*`, ADR-TBD) | Grey banner `AUCTION PAUSED`. Primary CTA disabled with label `PAUSED`. Countdown pill replaced by static `—`. | `saleStatus === 'PAUSED'` from WS. Until ADR lands, this is only hit via manual QA. |
| **Unauthenticated viewer** | Primary CTA reads `SIGN IN TO BID`; tapping opens `AuthModal`. Bid history, current bid, countdown all render normally (public data). | `viewer.isAuthenticated === false`. |
| **Placing bid** | CTA label → `PLACING BID…`, disabled. `lastError` cleared. | `BidPlacementState === 'bidding'`. |
| **Bid error** | CTA returns to `BID $X`; small red row between CTA and fine print: uses `bidErrorMessage(code, fallback)` from `lib/basta/client.ts`. | `BidPlacementState === 'idle'` with non-null `lastError`. |

### 4a. Where the custom-bid and max-bid affordances live

The Figma primary frame shows only the one-tap CTA. The two secondary flows need somewhere to sit; proposal:

- **Below the primary CTA, before the fine print**, a single row of two text buttons in `Berkeley Mono 11 text-[#5e5e5e] underline`:
  `CUSTOM AMOUNT` · `SET MAX BID`.
  This preserves the primary one-tap hierarchy and keeps the footer compact. When the user taps either, open the corresponding bottom sheet (`LiveCustomBidSheet` or `MaxBidSheet`).

Flag this as an open question for the designer (§6.4) — the `3705:*` "Custom bid" variant likely has the exact placement.

---

## 5. Implementation order

Each step ends at a state that renders something meaningful. Do not advance until the prior step types + runs on-device.

### Step 1 — Route skeleton (smallest shippable slice)
- Create `app/auctions/[auctionId]/live/page.tsx` modeled after `app/lots/[lotId]/page.tsx`.
- Tenant resolution + supabase client + `notFound()` gates.
- Fetch auction row + lots, seed a `<LiveAuctionScreen>` with **static** props (no hooks yet).
- `<LiveAuctionScreen>` renders the full visual tree with all regions, no real-time. Use RSC-seeded `currentBidCents` and a static countdown.
- Sticky footer works, one-tap CTA is wired to a `console.log`, no auth.
- **Ship-gate:** screen renders at `localhost:3000/auctions/<id>/live` and matches Figma 1:1 at 402px.

### Step 2 — Reusable visuals
- `components/live/live-top-bar.tsx` — no live data.
- `components/live/live-lot-hero.tsx` — wrap `ImageCarousel` with a 240px height override prop (smallest-delta API change).
- `components/live/live-lot-ribbon.tsx` — fork `storefront/lot-ribbon.tsx`, swap the `isCurrent` logic for `liveStatus` chip rendering.
- `components/live/countdown-pill.tsx` — accepts `countdownMs: number | null`, formats `MM:SS` or `HH:MM:SS`.
- `components/live/live-bid-footer.tsx` — static props only (no handlers yet beyond the one-tap stub).
- Reuse `LotInfo` unchanged.
- **Ship-gate:** pixel match at 402 and at tablet/desktop (same content, `max-w-xl mx-auto`).

### Step 3 — One-tap NORMAL bid path (no real-time yet)
- Wire `onOneTapBid` in `<LiveAuctionScreen>` to:
  1. If `!isAuthenticated`, open `AuthModal` (reusing the chain from `LotInfoPanel`).
  2. `fetchBidSupport(currentLot.id)` → cache on mount (not per-bid — the sale/item IDs don't change).
  3. `getBastaToken(session.access_token)`.
  4. `bidOnItem({ saleId, itemId, amount: nextIncrementBidCents, type: 'NORMAL', bidderToken })`.
  5. On `BID_TOO_LOW`, re-fetch bid support to refresh the increment table (price may have moved) and show the error via `bidErrorMessage()`.
  6. On `INVALID_TOKEN`/`UNAUTHORIZED`, refresh token once and retry (match the existing pattern in `max-bid-section.tsx` lines 97–110).
- `BidPlacementState` machine transitions: `idle → bidding → (success | idle+error)`.
- **Ship-gate:** placing a one-tap bid debits the lot's current bid in the DB (via webhook from M2); refresh to see it.

### Step 4 — Real-time current bid + countdown (Basta WS)
- Integrate `useSaleActivity(bastaSaleId)` (written in parallel by user; consume only, don't implement here).
- Replace the static current-bid / countdown seed with the hook's values. Seed remains the RSC initial; hook overrides once connected.
- Derive `viewerState` selector and wire `<LiveStatusBanner>`.
- Handle `itemStatus === 'CLOSED'` by swapping the footer to the SOLD block.
- On ribbon updates (next lot promoted to LIVE) navigate to the new lot's live view — either by reload or by re-hydrating `currentLot` from the current page's cached lot list. Simplest first-cut: push to `/auctions/[auctionId]/live?lotId=<new>` and read via `searchParams`. Avoid deep-linking complexity in M3.
- **Ship-gate:** price + countdown tick in real time on two side-by-side tabs.

### Step 5 — Real-time bid history (Supabase Realtime)
- Integrate `useBidFeed(auctionId, lotId)`.
- Render two most-recent; "VIEW ALL (N)" stays a placeholder button that opens an empty bottom sheet (`<LiveBidHistorySheet>` with a TODO — out of M3 scope per task prompt).
- **Ship-gate:** new bid from another user appears in the feed within 1s.

### Step 6 — Custom bid + max bid bottom sheets
- `live-custom-bid-sheet.tsx`: a thin wrapper with an input field, a `CONFIRM BID $X` CTA, and the same `bidOnItem(..., type: 'NORMAL')` call path but with user-entered `amountCents`. Validate `>= currentBid + increment`.
- `MaxBidSheet` is literally `ModalOverlay` + `<MaxBidSection lotId={...} startingBid={...} isAuthenticated onAuthRequired={...} />`. Zero new logic.
- Add the `CUSTOM AMOUNT · SET MAX BID` row under the primary CTA.
- **Ship-gate:** both sheets open, submit, close, and reflect in state.

### Step 7 — Edge states + polish
- Unauthenticated CTA label.
- "You're winning" / "You're outbid" banner copy per design system confirmation.
- Paused state (stub until ADR).
- Reduced-motion: countdown pill shouldn't animate for `prefers-reduced-motion: reduce`.
- `safe-area-inset-bottom` on footer; verify on iOS notch device.
- **Ship-gate:** manual QA matrix from §4 passes.

---

## 6. Open questions & gotchas

### 6.1 Basta subscription shape — unknown payload
The task prompt refers to `itemUpdates`/`saleUpdates` without binding to a concrete schema. **Need before implementation:** the exact GraphQL subscription operation text + `__typename` union we get back. The hook author is writing this in parallel — `<LiveAuctionScreen>` will consume whatever `UseSaleActivityResult` they ship. Plan above assumes the fields in §3b; if those names differ, update the consumer only.

### 6.2 Anonymous WS connection
Can an unauthenticated viewer open the Basta `saleActivity` subscription? The `createBidderToken` mutation takes any opaque `userId`, and Basta's docs say reads require no auth, but subscription auth is ambiguous. **Decision needed:** either mint a per-session anonymous bidder token server-side, or confirm the subscription works without `Authorization`. Blocks viewer-count-adjacent design. *Not blocking M3 MVP* — we can render the static seed + poll if the WS fails.

### 6.3 "Not yet live" navigation
If a buyer hits `/auctions/<id>/live` before `auction.status === 'live'`, what do we show? Options:
- **A)** Redirect to the preview screen (`/`, storefront root with lot grid).
- **B)** Render the live screen with CTA disabled + banner `AUCTION STARTS <date>`.
Recommend **A** for M3 (matches platform convention — live route is a live-only surface). One line in the RSC.

### 6.4 Placement of custom-bid & max-bid affordances
Figma primary frame shows only the one-tap CTA. The `3705:*` variants (Custom Bid input, Set Max Bid) exist per task prompt but were not enumerable via MCP. Proposal in §4a is a text-button row under the CTA. **Confirm with designer** before Step 6 — if the variants place these elsewhere (e.g. inside an overflow menu or as a long-press on the primary CTA), revise.

### 6.5 Can you "raise your own bid" while already winning?
If `leaderUserId === viewer.userId`, does the primary CTA remain enabled with `BID $<next>`? Auction convention says no (you can't outbid yourself), but some platforms let you raise your MAX. For the one-tap NORMAL path, the correct answer is **disable** (or hide) the CTA and only show `SET MAX BID`. Flag as a product decision.

### 6.6 Lot transition behavior
When `itemStatus` flips from LIVE → CLOSED on the current lot, the next upcoming lot should become LIVE. Two UX choices:
- **A)** Automatic in-place swap — `<LiveAuctionScreen>` re-renders with the next lot's data. Requires the page to hold *all* lot details client-side (big payload for a 40-lot sale).
- **B)** Show a short "NEXT LOT LOADING..." interstitial and navigate to the new lot's URL.
Recommend **B** for M3 — simpler RSC, smaller client bundle, and the brief freeze matches real auction pacing. Revisit if it feels janky.

### 6.7 `live_status` column source of truth
The ribbon reads `lots.live_status`. Who writes it? If Basta webhooks update it on `ItemsStatusChanged`, we're fine — confirmed in M2 per git log `a3f6cdc`. Double-check the webhook maps `ITEM_STATUS: CLOSED` → `live_status: 'sold'` and handles the "which lot is LIVE right now" transition (typically: set the just-closed lot to 'sold' and the lowest `sort_order` still 'upcoming' to 'live' in the same transaction).

### 6.8 Handle resolution for bid rows
`BidFeedEntry.handle` — where does it come from? Options:
- Join `bids` against a `profiles` table at query time (simplest; 1 extra join).
- Resolve client-side via a `useProfiles(userIds)` hook that caches in-memory.
Recommend the join for initial fetch (hydrated bids ship with handles) and a thin client cache for new realtime inserts. Profiles table existence & shape: need to confirm.

### 6.9 Lot hero image carousel vs single image
Task prompt says "use first entry in `lots.images[]`". Figma shows image-carousel controls (arrows + dot strip) on the hero. **Honor the task prompt** for M3 (single image, no intra-lot carousel in the live view — arrows/dots are visually present but disabled), and leave a TODO to wire full carousel in a follow-up. Rationale: the live screen's hero is only 240px tall, and scrolling through images competes with watching the price. If designer disagrees, swap to the already-built `ImageCarousel` — cost is one prop change.

### 6.10 Viewer count (M7)
`240` is a LiveKit-derived value. Until M7 lands, render the `<span className="text-[#ff5e61]">—</span>` placeholder so layout doesn't shift. Don't hide the element; the red dot + bright color is a visual hook that disappearing feels like a bug.

### 6.11 Ask-a-question chip (M7)
Same principle — render the chip disabled (`opacity-60`, `cursor-not-allowed`), clickable-but-no-op, so the hero doesn't look empty.

### 6.12 Next.js 16 dynamic params are Promises
Already the convention in this repo (verified in `app/lots/[lotId]/page.tsx`). No change needed, just flagging for the implementer not to revert to the Next 14 sync-params style. `PageProps<'/auctions/[auctionId]/live'>` is available as a globally-typed helper in Next 16 — prefer it over hand-typing the `Promise<{...}>` shape.

### 6.13 Sticky footer + iOS keyboard
When the custom-bid sheet opens with an input focused on iOS, the virtual keyboard overlaps a naive `sticky bottom-0`. Use `bottom: env(safe-area-inset-bottom)` plus a `visualViewport`-based offset inside the custom-bid sheet; do NOT put the input inside the sticky footer.

### 6.14 WebSocket lifecycle on tab background
Per the spec hint: "real-time subscription lifecycle on background/foreground transitions." Close the WS on `visibilitychange → hidden`, reopen on `visible`. Refetch `currentBidCents` + `countdownMs` via a one-shot query (or let the hook re-seed on reconnect). Don't keep the WS open indefinitely on a backgrounded tab — burns battery and risks stale token.

### 6.15 Font variables
The frame references `Berkeley_Mono_Trial` and `Inter_Display`. This repo already exposes them as `var(--storefront-font-mono)` and `var(--storefront-font-display)` (see `storefront-fonts.ts` + usage in `lot-info.tsx`). Use those CSS variables, never the `Berkeley Mono Trial` literal from Figma — that's a trial-font placeholder that would break in production.
