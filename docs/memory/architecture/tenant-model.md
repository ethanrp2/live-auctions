# Tenant model

How multi-tenancy works today in Live Auctions.

## The boundary

One shared deployment. One Supabase project (`fkatfnvscuvfejhdblks`). Multi-tenancy achieved by:

1. **Subdomain routing.** Request host header → subdomain → `tenants.slug` lookup → inject headers. See [`proxy.ts`](../../../proxy.ts) and [`lib/tenant.ts`](../../../lib/tenant.ts).
2. **`tenant_id` scoping on every row** of every tenant-scoped table (`auctions`, `lots`, `orders`, `auction_questions`, `profiles.tenant_id` for sellers).
3. **RLS policies** enforcing the scope on the database side. See [rls-policies.md](rls-policies.md).

No per-tenant infrastructure. Adding a new house is a row insert + a subdomain record (today: manual; M5 will make it self-serve).

## Request flow (per-request)

```
Request → proxy.ts
  ├── extract hostname, strip port
  ├── if no subdomain → serve main-domain pages (no tenant context)
  ├── else → getTenantBySlug(slug) (lib/tenant.ts, 1-min in-mem cache)
  │     └── if not found → rewrite to /not-found (404)
  ├── inject headers: x-tenant-id, x-tenant-slug, x-tenant-name
  ├── refresh Supabase auth cookies (cookie domain = .ROOT_DOMAIN)
  ├── gate protected routes (/account, /console) by user presence
  └── return response with updated cookies
```

Pages read tenant context via `headers()` in server components. See `app/page.tsx` for the pattern.

## Tables (tenant-scoped columns)

| Table | tenant_id column | Notes |
|---|---|---|
| `tenants` | (pk) | `storefront_auction_id` optionally pins which auction appears on the house subdomain. |
| `profiles` | nullable | NULL = buyer (cross-house); non-null = seller for that tenant. |
| `auctions` | not null | |
| `lots` | not null | |
| `orders` | not null | INSERT policy is `with_check: true` — relies on backend service role. |
| `auction_questions` | not null | |
| `sms_subscribers` | **missing** | Bug: should be tenant-scoped. Will fix in M8. |
| `auction_publish_locks` | (via auction_id) | |

## Reserved subdomains (to enforce in M5)

`www`, `admin`, `app`, `api`, `auth`, `main`, `assets`, `static`, `help`, `mail`, `dashboard`, `console`. Plus regex `^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`.

Today there's no enforcement — a seed script could create a tenant with any slug, including clashing ones. Acceptable for dev; blocker for prod.

## Current tenants (2026-04-21)

- `demo` — placeholder, no lots.
- `unsoundrags` — "February 80s-90s Vintage Tees", published, 9 lots, scheduled 2027-02-27.
- `basa` — "Vintage Furniture Archive", **live**, 9 lots, scheduled 2026-04-19.

## Gotchas

- `getTenantBySlug` caches for 60s per process. A branding change won't appear on an already-running Next process until the cache expires. Fine for now.
- Middleware runs before every request; an extra Supabase query per request for unknown-tenant lookups. Tolerable; won't matter until traffic.
- The main domain (no subdomain) currently serves a placeholder Home. See `app/page.tsx` — we'll either redirect to a marketing site or build a discovery page in M0 later / M5.

## What's next for this area

- M5: self-serve tenant creation (admin UI + invite flow). See [GAP_ANALYSIS_AND_PLAN.md](../../../GAP_ANALYSIS_AND_PLAN.md) WS2.
- M5: seller-editable branding (logo, hero, colors, fonts) via `/seller/settings`.

---

_Last verified: 2026-05-14_
