# Auth and subdomains

How Supabase auth works across our subdomains without the user having to re-login per house.

## The mechanism

Supabase cookies are set with `domain = .<ROOT_DOMAIN>` (leading dot) so any subdomain shares them. See [`lib/supabase/server.ts`](../../../lib/supabase/server.ts) and [`lib/supabase/proxy.ts`](../../../lib/supabase/proxy.ts).

```ts
const cookieDomain = `.${rootDomain}`;   // e.g. `.localhost` or `.liveauctions.com`
```

So a session minted on `basa.localhost:3000` is also valid on `unsoundrags.localhost:3000` and on the main `localhost:3000` domain. Same for production.

## The cross-subdomain callback hop

OAuth redirect URLs in Supabase have to be allow-listed. To avoid listing every tenant subdomain, magic links and OAuth callbacks go to the **platform root**, then cross-redirect. This matches the saved memory at `project_auth_subdomain_callback.md`.

The auth callback (`app/(auth)/auth/callback/route.ts`) exchanges the OAuth code → sets cookies → redirects to `?next=<wherever>` which may be on a subdomain. Because cookies are set with `.<ROOT_DOMAIN>`, the user lands on the subdomain already authenticated.

## Roles

One-dimensional today:
- **Buyer** = any authenticated user (`profiles.tenant_id IS NULL`).
- **Seller** = `profiles.is_seller = true AND profiles.tenant_id = <some tenant>`. Enforced in [`backend/src/lib/auth.ts`](../../../backend/src/lib/auth.ts) via `requireSeller`.
- **Admin** = not implemented yet. M5 adds `profiles.is_admin boolean` and `requireAdmin` helper.

## Protected routes (today)

Defined in [`proxy.ts`](../../../proxy.ts):
- `/account` — any authed user. Route page doesn't exist yet (M8).
- `/console` — any authed user (middleware only checks presence). Route page doesn't exist yet (M4 adds it + checks `is_seller`).

## Auth UI

- Root-level platform and tenant home pages now serve as the canonical sign-in entrypoints, with `/signup` retained for account creation. See `app/(auth)/` and the home pages.
- `/seller/onboarding` — tenant-scoped single-seller signup. Uses `admin.createUser` with `email_confirm: true` (i.e., skips verification). See `app/seller/onboarding/page.tsx` + `backend/src/routes/seller-onboarding.ts`. **Hardcoded to one seller per tenant** — lift in M5.
- `/seller/invite/[token]` — planned in M5 for invited teammates.

## Gotchas

- **Email verification is off for sellers.** `email_confirm: true` means the account is pre-verified. Fine for internal, needs toggle for production.
- **Password minimum is 6 chars.** Supabase default, should be bumped in settings.
- No passwordless / magic-link for buyers yet (only signup+login). Fine for MVP.
- No session revocation path (e.g., "log out all devices"). Supabase supports it but we don't expose it.

## Environment dependencies

Root + backend both need:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (anon key)
- `NEXT_PUBLIC_ROOT_DOMAIN` (defaults to `localhost`)

Backend also needs `SUPABASE_SERVICE_ROLE_KEY` for admin user creation and bypassing RLS on webhook/order writes.

See `.env.example` at repo root.

---

_Last verified: 2026-04-21_
