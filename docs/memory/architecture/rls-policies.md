# RLS policies

Row-Level Security inventory, per table. Postgres enforces these on every SELECT/INSERT/UPDATE/DELETE unless the request uses the service role (which bypasses RLS).

Verify with: `SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public';`

## Policy inventory (as of 2026-04-21)

| Table | Op | Policy name | qual (USING) | with_check | Notes |
|---|---|---|---|---|---|
| `tenants` | SELECT | Public read tenants | `true` | — | Public directory. OK. |
| `profiles` | SELECT | Users read own profile | `auth.uid() = id` | — | Restrictive; seller lookups by admin go via service role. |
| `profiles` | INSERT | Auto-create profile on signup | — | `auth.uid() = id` | User can only create their own row. |
| `profiles` | UPDATE | Users update own profile | `auth.uid() = id` | — | |
| `auctions` | SELECT | Public read auctions | `true` | — | Public directory. OK. |
| `auctions` | ALL | Sellers manage own auctions | `tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_seller = true)` | — | Applies to all ops incl. UPDATE. |
| `lots` | SELECT | Public read lots | `true` | — | Public directory. OK. |
| `lots` | ALL | Sellers manage own lots | (same tenant subselect) | — | |
| `orders` | SELECT | Buyers read own orders | `buyer_id = auth.uid()` | — | |
| `orders` | SELECT | Sellers read tenant orders | (tenant subselect) | — | |
| `orders` | INSERT | Backend insert orders | — | `true` | ⚠ Wide-open `with_check`. Relies on backend using service role exclusively. Frontend should never write to `orders`. |
| `orders` | UPDATE | (none) | — | — | ⚠ No update policy. Backend must use service role to write `payment_status`, `shipping_status`. Document this contract. |
| `auction_questions` | INSERT | Authenticated users ask questions | — | `auth.uid() = user_id` | User can only create questions with their own user_id. |
| `auction_questions` | SELECT | Sellers read tenant questions | (tenant subselect) | — | Buyers can't read each other's questions. |
| `auction_questions` | UPDATE | (none) | — | — | Dismiss-question in M7 will need service role or a new policy. |
| `sms_subscribers` | INSERT | Anyone can subscribe | — | `true` | Wide open. Risk of spam. Will lock down in M8. |
| `sms_subscribers` | SELECT | (none) | — | — | No read policy. Backend-only access via service role. |
| `auction_publish_locks` | ALL | (none) | — | — | RLS enabled but no policies → no client access. Backend-only via service role. |

## Service-role contracts

These are things the backend can do (via `SUPABASE_SERVICE_ROLE_KEY`) that no RLS policy permits:
- INSERT / UPDATE / DELETE on `auction_publish_locks`.
- UPDATE on `orders.payment_status`, `shipping_status`, `tracking_info`.
- UPDATE on `auction_questions.dismissed` (M7).
- INSERT on `bids` (M2 table — backend writes from webhooks).
- INSERT on `webhook_events` (M2).
- UPDATE on `lots.live_status`, `winner_user_id`, `winning_bid_cents`, `sold_at` (M4 console).
- UPDATE on `auctions.current_lot_id`, `went_live_at`, `ended_at` (M4 console).
- Any cross-tenant query (support, analytics).

Any new backend route that does these operations must use `supabaseAdmin` from [`backend/src/lib/supabase.ts`](../../../../backend/src/lib/supabase.ts), not a user-session client.

## Gaps / TODOs

- **No UPDATE policies on `orders`.** Fine as long as we commit to "backend is the only writer". Document this in M2.
- **`sms_subscribers` is unscoped.** Insert allowed from anywhere. A rogue client on `basa.localhost` could add phones to `unsoundrags`'s subscriber list. Needs a tenant-scoped policy in M8 (after we add `tenant_id` to the table).
- **`profiles` read policy is strict.** Sellers looking up buyer display names (for the bid feed) must go through a backend endpoint, not a direct join. M2's webhook handler joins via service role and broadcasts the name, so this isn't an issue in practice.
- **No admin role yet.** M5 adds `profiles.is_admin` + admin-specific policies (read all tenants, etc.).

## Testing RLS

Every new policy needs a paired test. Pattern:

```sql
-- Given a user A with tenant_id = X
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"<user-A-uuid>"}';
-- User A should see X's lots
SELECT count(*) FROM lots WHERE tenant_id = 'X';  -- expect >0
-- User A should NOT see Y's lots
SELECT count(*) FROM lots WHERE tenant_id = 'Y';  -- expect 0
```

No automated RLS test suite exists yet. Candidate for M0 follow-up or M2. Track manually in commit descriptions when touching RLS.

---

_Last verified: 2026-04-21_
