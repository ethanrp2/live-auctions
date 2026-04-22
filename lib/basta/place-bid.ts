/**
 * High-level bid-placement helper.
 *
 * Wraps the full flow used by callers like <MaxBidSection>:
 *   1. fetchBidSupport(lotId)        → saleId + itemId
 *   2. getBastaToken(supabaseToken)  → bidder JWT (module-cached, 5-min buffer)
 *   3. bidOnItem(...)                → place the bid
 *   4. On INVALID_TOKEN / UNAUTHORIZED: invalidate the cached bidder token
 *      and retry bidOnItem ONCE with a freshly-minted token.
 *
 * Returns the normalized BastaBidResult from lib/basta/client.ts. Callers can
 * branch on `result.ok` and format errors via `bidErrorMessage`.
 *
 * See docs/memory/architecture/basta-integration.md for the bid flow.
 */

import { getBastaToken, invalidateBastaTokenCache } from "@/lib/basta-token";
import { fetchBidSupport } from "@/lib/basta/bid-support";
import type { BidIncrementRule } from "@/lib/basta/bid-support";
import { resolveIncrement } from "@/lib/basta/bid-support";
import { bidOnItem } from "@/lib/basta/client";
import type { BastaBidResult, BastaBidType } from "@/lib/basta/client";

export async function placeBidForLot(params: {
  lotId: string;
  type: BastaBidType;
  /** Integer cents. See docs/memory/architecture/money-units.md. */
  amountCents: number;
  supabaseAccessToken: string;
}): Promise<BastaBidResult> {
  const { lotId, type, amountCents, supabaseAccessToken } = params;

  // 1. Resolve Basta saleId + itemId via our backend helper.
  const support = await fetchBidSupport(lotId);

  // 2. Mint (or reuse cached) Basta bidder token.
  const bidderToken = await getBastaToken(supabaseAccessToken);

  // 3. Place the bid.
  const first = await bidOnItem({
    bidderToken,
    saleId: support.saleId,
    itemId: support.itemId,
    amount: amountCents,
    type,
  });

  // 4. Refresh-and-retry once on expired/invalid token. The token cache has
  //    a 5-min refresh buffer, so expiry mid-flight is rare but possible if
  //    Basta rotates keys or the browser tab was idle.
  if (
    !first.ok &&
    (first.errorCode === "INVALID_TOKEN" ||
      first.errorCode === "UNAUTHORIZED")
  ) {
    invalidateBastaTokenCache();
    const refreshed = await getBastaToken(supabaseAccessToken);
    return bidOnItem({
      bidderToken: refreshed,
      saleId: support.saleId,
      itemId: support.itemId,
      amount: amountCents,
      type,
    });
  }

  return first;
}

/**
 * Compute the next valid bid amount (in cents) for a lot given the current
 * high bid, the sale's bid-increment table, and the lot's starting bid.
 *
 *   - If there are no bids yet (`currentBidCents === 0`) → return the
 *     starting bid, which is always a valid first bid.
 *   - Otherwise → look up the step that applies at `currentBidCents` and
 *     return `currentBidCents + step`.
 *   - Returns `null` if no increment rule resolves (caller should refuse to
 *     bid or surface an error).
 */
export function computeNextBidAmountCents(
  currentBidCents: number,
  rules: BidIncrementRule[] | null,
  startingBidCents: number
): number | null {
  if (currentBidCents === 0) return startingBidCents;

  const step = resolveIncrement(currentBidCents, rules);
  if (step == null) return null;
  return currentBidCents + step;
}
