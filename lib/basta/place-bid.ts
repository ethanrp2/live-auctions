/**
 * High-level bid-placement helper.
 *
 * Wraps the full flow used by callers like <MaxBidSection>:
 *   1. fetchBidSupport(lotId)        → saleId + itemId
 *   2. bidOnItem(...)                → place the bid through our backend.
 *
 * Returns the normalized BastaBidResult from lib/basta/client.ts. Callers can
 * branch on `result.ok` and format errors via `bidErrorMessage`.
 *
 * See docs/memory/architecture/basta-integration.md for the bid flow.
 */

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

  return bidOnItem({
    supabaseAccessToken,
    saleId: support.saleId,
    itemId: support.itemId,
    amount: amountCents,
    type,
  });
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
