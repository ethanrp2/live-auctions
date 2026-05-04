---
name: ADR-003 — MVP shipping is record-keeping only
type: decision
date: 2026-05-03
---

## Decision
No Shippo integration for MVP. Shipping is handled as follows:

1. On SELL, the platform creates an `orders` row with `buyer_id`, `lot_id`, `sale_price`.
2. `buyer_id` → `profiles.shipping_address` contains the full shipping address (captured when the buyer saves their info before bidding).
3. Sellers view winner details (name, address, winning bid) via `GET /api/auctions/:auctionId/winners` in the console.
4. Sellers coordinate fulfillment externally (email, phone, courier of their choice).
5. `orders.tracking_info jsonb` and `orders.shipping_status` columns are retained for future integration.

## Why
- MVP scope: Shippo integration adds significant complexity (label generation, carrier APIs, address validation, return flows) for no immediate buyer-facing value.
- Auction houses already have their own fulfillment workflows; they don't need the platform to dictate carriers.
- Capturing winner info in the DB (with the address link via `profiles`) gives sellers everything they need.

## How to apply
- Do NOT build Shippo API calls.
- The `orders` table's `tracking_info` and `shipping_status` columns are future hooks — leave them nullable.
- The seller console winners view should show: lot title, buyer display_name, buyer email (from `auth.users`), buyer `profiles.shipping_address`, and `sale_price` (in cents — display with `formatMoneyCents`).
- When building M6 (Stripe), wire `payment_status` but leave `shipping_status` as `'pending'`.
