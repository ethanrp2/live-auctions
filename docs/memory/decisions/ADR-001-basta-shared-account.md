# ADR-001 — Single shared Basta account across all tenants

**Status:** Provisional. Pending confirmation from Basta support (see [risks/basta-questions.md](../risks/basta-questions.md) Q9). Will ratify or reverse after their reply.

**Date:** 2026-04-21

## Context

Basta authenticates Management API calls with `x-account-id` + `x-api-key`. Each account has its own sales, items, bidder tokens, and dashboard. We're a multi-tenant platform where each house (tenant) is a commercially independent seller.

Two architectural options:
1. **Shared Basta account** — every house's sales live under one `accountId`. Platform owns Basta billing.
2. **Per-tenant Basta account** — each house creates + connects their own Basta account. We store their credentials and proxy calls through.

The existing code (as of 2026-04-21) assumes shared — `BASTA_ACCOUNT_ID` is a single backend env var, not per-tenant.

## Decision

**Keep shared** for v1. Every tenant's sales and items live under our one `BASTA_ACCOUNT_ID`. Tenant scoping is platform-side (our Postgres `tenant_id` on `auctions` + `lots`).

## Consequences

Good:
- Simpler onboarding: sellers don't need to create a Basta account.
- Simpler auth: one API key, no per-tenant key rotation.
- Simpler development: seed scripts, dev env, and staging all use the same account.
- We own the Basta commercial relationship; sellers can't misconfigure it.

Bad:
- We pay Basta; sellers don't. Cost scales with our total volume, not per-seller. Factor into platform fee (ADR-005 in M6).
- A compromised Basta API key leaks every tenant's auction data.
- A Basta outage / rate-limit affects all tenants simultaneously.
- We are responsible for noisy-neighbor isolation within Basta (e.g., a huge sale from house A doesn't starve house B). Basta's rate-limiting posture is TBD (filed in risks).

## Open before ratifying

- Confirm with Basta support that they recommend this for platforms our size.
- Understand their per-account rate limits (Management + Client + WS connections + bidOnItem/sec).
- Confirm their Pricing matches our multi-tenant usage — some vendors charge per account, some per sale.

## Supersedes / Superseded by

(none)
