# Risks — Basta open questions

Email these to Basta support at the start of M1. Most answers unblock M4 (seller console). Until then, we design around the unknowns (see [architecture/basta-integration.md](../architecture/basta-integration.md) for current assumptions).

## Docs check (2026-04-21)

Cross-checked all 10 questions against the full Basta skill reference (`management_api.md`, `client_api.md`, `webhooks.md`, `glossary.md`):

- **Q1–Q4, Q8**: Mutations not listed in the Management API reference. That reference enumerates exactly 8 mutations (`createSale`, `createItem`, `addItemToSale`, `createItemForSale`, `removeItemFromSale`, `publishSale`, `createBidderToken`) plus `bidOnItem` on the Client API. No `closeItem`, `updateItem`, `updateSale`, `pauseSale`, or token-revocation mutation exists in the public reference. These are genuine unknowns — need Basta to confirm whether they exist undocumented or need to be built around.
- **Q5 (webhook signature)**: `webhooks.md` explicitly defers to an "authenticating webhook payloads documentation" that isn't in the public reference we have access to. Genuine unknown.
- **Q6 (webhook source IPs)**: `webhooks.md` says "Check source IP if possible" but doesn't publish a list. Genuine unknown.
- **Q7 (bidder identity in real-time feed)**: **Partially resolved.** The `BidOnItem` webhook payload DOES include `userId` (and `saleState.newLeader`, `prevLeader`). That covers our "live bid feed with names" use case, just with one extra hop (Basta → our webhook → Supabase Realtime → client). Remaining question is whether there's a *subscription* that includes bidder userId too (for <500ms latency instead of ~800ms) — this is a latency optimization, not a feature blocker. Downgraded in importance.
- **Q9 (multi-tenant account model)**: Commercial question; not a technical doc issue.
- **Q10 (rate limits)**: Docs say "Use batch operations where possible" / "Cache query results appropriately" without concrete numbers. Genuine unknown.

**Conclusion:** 9 of 10 questions remain genuinely open. Q7 is downgraded to an optimization ask. Sending the email as-is is the right call.

## Open

### Q1. Close-item-now primitive?
**Risk:** No documented `closeItem` mutation. Seller "SELL" button has no way to force a Basta item into CLOSED state — we'd have to wait for `closingDate`, meaning stragglers can bid on sold lots.
**Owner:** Basta support.
**Trigger:** Reply to Q1.
**Blocks:** M4 seller console UX; M8 END AUCTION cleanup.
**Opened:** 2026-04-21.
**Status:** Open.

### Q2. `updateItem` or `updateSaleItem` with `closingDate`?
**Risk:** Fallback for Q1 if no native close-now exists. If we can set `closingDate = now + 1s`, Basta will close the item shortly.
**Owner:** Basta support.
**Trigger:** Reply to Q2.
**Blocks:** M4 (workaround), M8.
**Opened:** 2026-04-21.
**Status:** Open.

### Q3. Pause-sale primitive?
**Risk:** No way to halt all bidding on a sale for a few minutes. We have an app-level workaround (reject in backend + hide UI) but bids from a client with an unexpired token can still reach Basta.
**Owner:** Basta support.
**Trigger:** Reply to Q3.
**Blocks:** M4 pause feature (if undocumented, we ship app-level-only).
**Opened:** 2026-04-21.
**Status:** Open.

### Q4. `updateSale(bidIncrementTable)` on a published sale?
**Risk:** Seller wants to adjust increments mid-auction. Our workaround is to mirror the table locally and let seller override per-lot; Basta will still validate against its stored rules. If Basta allows live updates, we can reduce complexity.
**Owner:** Basta support.
**Trigger:** Reply to Q4.
**Blocks:** M1 (we mirror regardless), but simplifies M4 if yes.
**Opened:** 2026-04-21.
**Status:** Open.

### Q5. Webhook signature algorithm + header name?
**Risk:** Signature verification page is "under construction" in public docs. Going to prod with unsigned webhooks on a public endpoint is a security blocker.
**Owner:** Basta support.
**Trigger:** Spec provided (algorithm, header name, secret location).
**Blocks:** M2 (we can dev against stub verification; can't ship).
**Opened:** 2026-04-21.
**Status:** Open.

### Q6. Source IP range for webhook delivery?
**Risk:** Allowlisting Basta IPs is a belt-and-suspenders defense alongside signature verification.
**Owner:** Basta support.
**Trigger:** IP list provided.
**Blocks:** Hardening, not shipping.
**Opened:** 2026-04-21.
**Status:** Open.

### Q7. Subscription stream with bidder `userId`? (downgraded)
**Risk:** `itemUpdates` / `saleUpdates` include `currentBid`, `bidCount`, `myBidStatus` — but don't seem to include who just bid. Good news: the `BidOnItem` webhook payload DOES include `userId` + `saleState.newLeader/prevLeader` (confirmed in `webhooks.md`), so our M3 bid feed will work by piping webhook → Supabase Realtime → client. Remaining ask is a pure latency optimization: is there a subscription-level signal that would let us skip the webhook round-trip?
**Owner:** Basta support.
**Trigger:** Reply to Q7.
**Blocks:** Nothing. M3 bid feed ships either way.
**Opened:** 2026-04-21.
**Status:** Open (downgraded to optimization).

### Q8. Bidder-token revocation?
**Risk:** For pause or security incidents, we may need to invalidate a bidder's token before TTL. No documented mechanism.
**Owner:** Basta support.
**Trigger:** Reply to Q8.
**Blocks:** M3–M4 pause hardening.
**Opened:** 2026-04-21.
**Status:** Open.

### Q9. Multi-tenant account model: shared vs per-tenant?
**Risk:** We're currently on shared (see [ADR-001](../decisions/ADR-001-basta-shared-account.md)). Need Basta's recommendation for platforms at our scale and the commercial implications.
**Owner:** Basta support.
**Trigger:** Reply to Q9.
**Blocks:** Ratification of ADR-001. Doesn't block any milestone.
**Opened:** 2026-04-21.
**Status:** Open.

### Q10. Rate limits (Management API burst, Client API, WebSocket concurrency, bidOnItem/sec)?
**Risk:** Unknown ceilings. Bulk-publishing a 200-lot auction could hit Management API limits. A popular auction could hit Client API / WS limits.
**Owner:** Basta support.
**Trigger:** Limits documented.
**Blocks:** Capacity planning; not a milestone blocker but prevents launch without answers.
**Opened:** 2026-04-21.
**Status:** Open.

---

## Archive (resolved)

_(none yet)_
