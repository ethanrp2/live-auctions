# Basta support email — draft (2026-04-21)

Open questions from [basta-questions.md](basta-questions.md), bundled into one message. Send as-is or trim before sending. Don't wait for a reply — continue M1–M4 against current assumptions.

**To:** support@basta.app (or contact form if different)
**From:** ethan.pereira@regalvoice.com
**Subject:** Integration questions for a live-auction platform built on Basta

---

Hi Basta team,

I'm building a multi-tenant live-auction platform ("Shopify for auction houses") on top of the Basta Management + Client APIs. Account ID: `af9d77d6-2feb-4293-bd1d-dddc66b831d1`. We have the buyer MAX-bid path working end-to-end against your Client API and are starting on the live seller console + webhook ingestion next. A handful of questions remain where the public Management API / Client API / webhooks references don't cover the behavior we need — would appreciate guidance on each.

1. **Close-item-now.** Is there a mutation to force a specific item into CLOSED immediately — the "hammer down" action a live auctioneer performs? The Management API reference enumerates `createSale / createItem / addItemToSale / createItemForSale / removeItemFromSale / publishSale / createBidderToken` and no `closeItem`. We're relying on `closingDate` today, which lets late bids slip in after a seller has called a lot sold.

2. **`updateItem` / `updateSaleItem` with `closingDate`.** If there's no close-now primitive, is setting `closingDate = now + 1s` via an update mutation a supported workaround? No `updateItem` mutation is listed in the public Management API reference — is it undocumented, or genuinely absent?

3. **Pause-sale.** Any primitive to temporarily halt bidding across a whole sale? Use case: seller needs to handle a buyer question or tech issue mid-auction. If there isn't one, we'll ship app-level only (which leaks — a client with an unexpired bidder token can still reach the Client API directly).

4. **`updateSale(bidIncrementTable)` on a PUBLISHED sale.** Can the increment table be modified after publish, or is it immutable once `publishSale` is called? No `updateSale` is listed in the reference.

5. **Webhook signature verification spec.** `webhooks.md` defers to a separate "authenticating webhook payloads documentation" we don't have access to. Could you share the algorithm, the header name, and where the signing secret is surfaced in the dashboard? We need this to ship webhooks to production.

6. **Source IP ranges for webhook delivery.** For defense-in-depth alongside signature verification, do you publish a stable IP allow-list for webhook delivery?

7. **Optimization: subscription-level bidder identity.** The `BidOnItem` webhook payload already includes `userId` + `saleState.newLeader` / `prevLeader`, so we can build a "@username bid $X" live feed via webhook → our backend → Supabase Realtime → client. That's ~800ms e2e. Is there a subscription field on `itemUpdates` / `saleUpdates` that includes bidder `userId` directly, so we could skip the webhook hop and get to ~300ms? Not a blocker — strictly a latency optimization.

8. **Bidder-token revocation.** Is there a way to invalidate a bidder token before its TTL? `createBidderToken` returns `{ token, expiration }` but no revoke mutation is listed. Use case: pause a specific user's bidding, or security incident response.

9. **Multi-tenant account model.** We're currently using a single shared Basta account across all tenants of our platform (houses see only their own sales in our UI, but Basta sees one flat list). Is that the recommended pattern for a platform like ours, or do you have a multi-account / multi-org model you'd suggest instead? What are the commercial implications?

10. **Rate limits.** The docs advise "use batch operations" / "cache query results" but don't give numbers. What are the current limits on:
    - Management API (burst + sustained, relevant for bulk-publish of 100+ lot auctions)?
    - Client API queries?
    - WebSocket concurrent connections per sale?
    - `bidOnItem` mutation throughput per sale?

Happy to share our integration diagram if useful. Thanks for building a solid API — everything we've wired up so far has worked as documented.

Best,
Ethan Pereira
