# Money units

**All money is integer cents. USD only. No floats anywhere.**

## The rule

Every money column in Postgres is `integer` (or `bigint` if it might exceed ~$21M, but we don't yet). Every money value passed across an API boundary is integer cents. Every Basta call uses cents (Basta's convention). Every Stripe call uses cents (Stripe's convention). Every UI display converts cents → dollars at the last possible moment, via a shared formatter.

**Never** `numeric`, `float`, or `decimal`. Never dollars as decimals in a JSON payload. Never "$120.50" as a string.

Rationale:
- Floats lose pennies.
- Cents align with Basta + Stripe natively — no conversion at integration boundaries.
- Integer arithmetic is free.

## Where this applies

All columns in `lots`: `estimate_low`, `estimate_high`, `starting_bid`, `reserve`, `winning_bid_cents`. All columns in `orders`: `sale_price`. All future Stripe columns (`platform_fee_cents`, `seller_fee_cents`). All future `bids` columns (`amount_cents`, `max_amount_cents`).

## The historical flag

`lots.money_in_cents boolean NOT NULL DEFAULT false` exists as a migration breadcrumb from when rows were mixed. See [ADR-002](../decisions/ADR-002-money-in-cents.md) for the cleanup migration. After M0, this column is **dropped**. If you see it mentioned anywhere, that reference is stale.

## UI formatting

Canonical formatter: [`lib/format.ts`](../../../lib/format.ts) → `formatMoneyCents(cents: number | null): string`.

The earlier `formatMoney(dollars)` signature is deprecated as of 2026-04-21 (M0). Any code passing dollars to `formatMoney` is broken; update to cents.

```ts
formatMoneyCents(1250000)  // "$12,500"
formatMoneyCents(null)     // "—"
```

For ranges:

```ts
formatEstimateCents(low: number | null, high: number | null): string
// formatEstimateCents(250000, 250000)   → "$2,500.00"
// formatEstimateCents(240000, 300000)   → "$2,400 – $3,000"
// formatEstimateCents(null, null)       → "—"
```

## Input parsing

When a seller types a dollar amount in a form (`"$1,250"` or `"1250"` or `"1250.50"`), convert at the form boundary:

```ts
function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars)) throw new Error("Invalid money input");
  return Math.round(dollars * 100);
}
```

Never store the raw string. Never store the intermediate float.

## Gotchas

- Don't use `toLocaleString('en-US', { style: 'currency' })` — it produces `$1,250.00` but we want `$1,250` (no decimals) for whole-dollar amounts. See `formatMoneyCents` for the exact pattern.
- When calling Basta `bidOnItem(amount: N)`, `N` is cents. Copy-pasting a Basta docs example? Check the unit.
- When reading bid amounts from Basta subscriptions or webhooks, `currentBid` is cents. Same for `amount`, `maxAmount`.

## What's next

Nothing. This is stable. The only change is that ADR-002 drops the `money_in_cents` column, which happens in M0.

---

_Last verified: 2026-04-21_
