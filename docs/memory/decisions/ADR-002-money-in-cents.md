# ADR-002 — All money stored and transported as integer cents

**Status:** Accepted.

**Date:** 2026-04-21

## Context

We currently have a mixed-units problem. The `lots.money_in_cents boolean` column exists as a migration breadcrumb: some rows (e.g., live BASA auction) have `money_in_cents=true` and store cents; others have `money_in_cents=false` and store dollars. The user's `project_money_units` memory ratifies **cents everywhere** as the convention, with the migration dated 2026-04-19.

Basta's API uses cents natively. Stripe's API uses cents natively. Floats are dangerous for money (penny errors). Mixing units forces every reader to branch on a flag.

## Decision

1. Every money column in Postgres is `integer` cents.
2. Every money value across every API boundary (our backend, Basta, Stripe, webhooks) is integer cents.
3. UI converts cents → dollars only at render time, via shared formatter `formatMoneyCents` in `lib/format.ts`.
4. Form inputs collect dollars (natural for humans), convert to cents at the form boundary.
5. Drop the `lots.money_in_cents` column after backfill.

The migration (`supabase/migrations/step12_money_units_cleanup.sql`) audits first: if any row has `money_in_cents=false`, the migration fails loudly (so a human converts deliberately rather than silently multiplying by 100). Once the audit passes, it drops the column.

_Audit on 2026-04-21: all 24 rows had `money_in_cents=true`. No backfill needed — the migration is effectively just `ALTER TABLE lots DROP COLUMN money_in_cents;` with a safety assertion._

## Consequences

Good:
- No mental tax reading a lot row ("is this dollars or cents?" is always cents).
- Zero conversion at Basta + Stripe boundaries.
- Float imprecision eliminated.
- Bid increment math (lookup + addition) is integer-safe.

Bad:
- Existing UI code that calls `formatMoney(dollars)` must migrate to `formatMoneyCents(cents)`. We rename the function to force a type-aware migration (no silent miscalculations).
- Seed scripts that assumed dollars must be updated to pass cents. `backend/scripts/seed-basa.ts` has `starting_bid: 15` — that's currently 15 cents ($0.15), which is wrong. Needs fixing as part of M0.
- Any PR description mentioning a dollar amount should note whether storage is in cents to avoid confusion during code review.

## Supersedes / Superseded by

(none)

## Rollback

Not recommended. If required: create a new migration that adds the column back + converts specific rows. But why would you — integer cents is the default for every payments + auctions platform on earth.
