import type { FastifyBaseLogger } from "fastify";
import { supabaseAdmin } from "../supabase.js";
import type { BastaBidOnItemData } from "./types.js";

/**
 * Persist a BidOnItem event to `public.bids`.
 *
 * Handles two kinds of rows in one event:
 *   1. The primary bid the user placed (top-level fields).
 *   2. Any reactive bids Basta auto-placed (in `reactiveBids[]`, only for
 *      MAX-bid scenarios where an existing MAX is pushed up).
 *
 * We look up tenant_id + auction_id + lot_id via lots.basta_item_id. If the
 * lot is unknown we skip the event (Basta sent a bid for an item we never
 * published — shouldn't happen, but don't crash the handler pipeline).
 *
 * Idempotency is guaranteed by `bids.basta_bid_id UNIQUE` — duplicate
 * inserts throw `23505` which we treat as success.
 */
export async function handleBidOnItem(
  data: BastaBidOnItemData,
  log: FastifyBaseLogger
): Promise<void> {
  // Resolve lot / auction / tenant from basta_item_id.
  const { data: lot, error: lotErr } = await supabaseAdmin
    .from("lots")
    .select("id, auction_id, tenant_id")
    .eq("basta_item_id", data.itemId)
    .maybeSingle<{ id: string; auction_id: string; tenant_id: string }>();

  if (lotErr) {
    log.error({ err: lotErr, itemId: data.itemId }, "lot lookup failed");
    throw lotErr;
  }

  if (!lot) {
    log.warn(
      { itemId: data.itemId, saleId: data.saleId, bidId: data.bidId },
      "BidOnItem for unknown lot — skipping"
    );
    return;
  }

  // Build the rows we're going to insert: the primary bid + any reactive
  // bids. reactiveBids[] items don't carry a bidType — they're always MAX
  // (that's the whole point of reactive bidding).
  type BidRow = {
    tenant_id: string;
    auction_id: string;
    lot_id: string;
    user_id: string;
    basta_bid_id: string;
    amount_cents: number;
    max_amount_cents: number;
    bid_type: "MAX" | "NORMAL";
    reactive: boolean;
    placed_at: string;
  };

  const placedAt = normalizePlacedAt(data.bidDate);

  const rows: BidRow[] = [
    {
      tenant_id: lot.tenant_id,
      auction_id: lot.auction_id,
      lot_id: lot.id,
      user_id: data.userId,
      basta_bid_id: data.bidId,
      amount_cents: data.amount,
      // For NORMAL bids Basta still populates maxAmount; it equals amount.
      max_amount_cents: Math.max(data.maxAmount, data.amount),
      bid_type: data.bidType,
      reactive: false,
      placed_at: placedAt,
    },
    ...(data.reactiveBids ?? []).map<BidRow>((r) => ({
      tenant_id: lot.tenant_id,
      auction_id: lot.auction_id,
      lot_id: lot.id,
      user_id: r.userId,
      basta_bid_id: r.bidId,
      amount_cents: r.amount,
      max_amount_cents: Math.max(r.maxAmount, r.amount),
      bid_type: "MAX",
      reactive: true,
      // Reactive bids have no explicit timestamp in the payload; treat them
      // as happening at the same moment as the trigger bid.
      placed_at: placedAt,
    })),
  ];

  // Upsert on basta_bid_id so a redelivered event is a no-op.
  const { error: insertErr } = await supabaseAdmin
    .from("bids")
    .upsert(rows, { onConflict: "basta_bid_id", ignoreDuplicates: true });

  if (insertErr) {
    log.error({ err: insertErr, bidId: data.bidId }, "bids upsert failed");
    throw insertErr;
  }

  log.info(
    {
      bidId: data.bidId,
      itemId: data.itemId,
      userId: data.userId,
      amount: data.amount,
      reactiveCount: data.reactiveBids?.length ?? 0,
    },
    "BidOnItem persisted"
  );
}

/**
 * Basta's docs show `bidDate` as "2024-02-27 10:23:08.181026943" — missing
 * the `T` and the tz suffix. Postgres will accept this via text→timestamptz
 * cast, but to be safe we normalize to ISO-8601 UTC. If parsing fails we
 * fall back to the server's now().
 */
function normalizePlacedAt(bidDate: string): string {
  if (!bidDate) return new Date().toISOString();
  const withT = bidDate.includes("T") ? bidDate : bidDate.replace(" ", "T");
  const withZ = /[Zz]|[+-]\d{2}:?\d{2}$/.test(withT) ? withT : `${withT}Z`;
  const d = new Date(withZ);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
