# Memory Index

One-line catalog of every page in this memory system. Read this to remember what exists. Never write content directly into this file — only one-line entries pointing to other pages.

## Rules of engagement

Read [SCHEMA.md](SCHEMA.md) first if you're new here or haven't touched this in a while.

## Append-only log

- [log.md](log.md) — append-only chronological log of meaningful events. Latest entries at bottom.

## Architecture (how the system works today)

- [architecture/tenant-model.md](architecture/tenant-model.md) — subdomain routing, tenant lookup, RLS scoping boundary.
- [architecture/auth-and-subdomains.md](architecture/auth-and-subdomains.md) — Supabase auth, cookie domain, cross-subdomain callback hop.
- [architecture/money-units.md](architecture/money-units.md) — cents everywhere; canonical unit and storage rules.
- [architecture/basta-integration.md](architecture/basta-integration.md) — what's wired, what's not; Basta boundary definition.
- [architecture/realtime-channels.md](architecture/realtime-channels.md) — Supabase Realtime publication + planned Basta WS channels.
- [architecture/rls-policies.md](architecture/rls-policies.md) — RLS policy inventory by table.

## Decisions (ADRs — one file per accepted decision)

- [decisions/ADR-001-basta-shared-account.md](decisions/ADR-001-basta-shared-account.md) — one Basta account shared across all tenants.
- [decisions/ADR-002-money-in-cents.md](decisions/ADR-002-money-in-cents.md) — all money stored and moved as integer cents; drop `lots.money_in_cents` flag.

## Risks (open questions + external blockers)

- [risks/basta-questions.md](risks/basta-questions.md) — 10 open questions to Basta support (close-item, pause, webhook signature, etc.). Includes a 2026-04-21 docs-check note.
- [risks/basta-support-email-draft.md](risks/basta-support-email-draft.md) — sendable email bundling the 10 questions; cites which Basta docs we checked.
- [risks/stripe-connect.md](risks/stripe-connect.md) — Stripe Connect onboarding + KYC timing.
- [risks/twilio-a2p.md](risks/twilio-a2p.md) — A2P 10DLC brand/campaign registration for US SMS.
- [risks/livekit-ios.md](risks/livekit-ios.md) — iOS Safari audio autoplay / tap-to-unmute UX.

## Glossary

- [glossary/auction-terms.md](glossary/auction-terms.md) — auction-domain terms I might forget.

## Sessions (end-of-session handoffs — newest at top)

- [sessions/2026-04-21.md](sessions/2026-04-21.md) — gap analysis + plan + memory seed + **M0 shipped** (money migration, format.ts cents API, env examples, bootstrap) + **M1 shipped** (real MAX-bid path: Basta Client API wrapper, bid-support endpoint, increment-table mirror, support-email draft).
