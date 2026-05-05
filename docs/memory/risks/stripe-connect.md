# Risks — Stripe Connect

## Open

### KYC timing per seller
**Risk:** Stripe Connect Express onboarding requires each seller to submit KYC (business info, bank, identity verification). This takes 24–72 hours for US sellers, longer internationally. A seller signing up "today" can't accept real payments "today".
**Owner:** Each seller + Stripe.
**Trigger:** `account.updated` webhook with `charges_enabled: true` and `payouts_enabled: true`.
**Blocks:** M6 end-to-end demo for any new seller. Existing test flows can use a pre-verified test account.
**Mitigations:**
1. Tell sellers up-front in onboarding ("plan 3 business days before first auction").
2. Show KYC status prominently in `/seller/settings → Payouts`.
3. Gate the publish button ("Cannot publish until payouts enabled").
**Status:** Open (inherent, not something we can fix — plan around).

### Per-tenant platform fee override
**Risk:** ADR-005 (pending, M6) sets a flat 5% fee. Some sellers will negotiate custom rates. We need the schema ready but no UI for it in v1.
**Owner:** Me.
**Trigger:** When a seller negotiates.
**Blocks:** Nothing immediately; add `tenants.platform_fee_bps integer default 500` (5% = 500 basis points) in M6's migration.
**Status:** Deferred to M6.

### Refund policy + dispute playbook
**Risk:** What do we do when a buyer charges back, or the seller refuses to ship? Stripe's default dispute handling falls on the Connect account (seller), but we become responsible if we mediate.
**Owner:** Me + legal.
**Trigger:** First dispute or first friendly seller feedback.
**Blocks:** M6 launch to real money.
**Status:** Open. Decision deferred; v1 posture = seller handles, we expose a "refund" button and nothing more.

### SCA / 3DS handling
**Risk:** Some saved cards require Strong Customer Authentication per transaction (EU, UK). Off-session charging (`off_session: true`) can fail with `authentication_required`. Our flow doesn't currently handle this — the charge would fail, we'd notify the seller, buyer would need to re-auth in a follow-up flow.
**Owner:** Me.
**Trigger:** First EU buyer.
**Blocks:** International launch. US-only MVP is fine.
**Status:** Deferred.

---

## Archive

_(none)_
