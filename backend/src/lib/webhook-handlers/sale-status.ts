import type { FastifyBaseLogger } from "fastify";
import { supabaseAdmin } from "../supabase.js";
import type { BastaSaleStatusChangedData } from "./types.js";

/**
 * Map Basta's sale status enum to our `auctions.status` text enum.
 *
 * Our column today accepts: 'draft' | 'published' | 'live' | 'ended' | 'closed'.
 * Basta emits: UNPUBLISHED | PUBLISHED | OPEN | CLOSING | CLOSED.
 *
 * Mapping chosen to keep the existing storefront filter (which accepts
 * `status IN ('live','published')`) functioning with no changes.
 */
const STATUS_MAP: Record<
  BastaSaleStatusChangedData["saleStatus"],
  string | null
> = {
  UNPUBLISHED: "draft",
  PUBLISHED: "published",
  OPEN: "live",
  // CLOSING isn't really "ended" — items can still take bids — but at the
  // sale-wide level we treat it as live-tail. Individual lots track
  // CLOSING separately via ItemsStatusChanged.
  CLOSING: "live",
  CLOSED: "ended",
};

export async function handleSaleStatusChanged(
  data: BastaSaleStatusChangedData,
  log: FastifyBaseLogger
): Promise<void> {
  const mapped = STATUS_MAP[data.saleStatus];
  if (mapped == null) {
    log.warn(
      { saleStatus: data.saleStatus, saleId: data.saleId },
      "unknown saleStatus — skipping"
    );
    return;
  }

  // Find the auction by basta_sale_id. We key off that because sales are
  // created via the Management API (publish.ts) and we persisted the id
  // there.
  const patch: Record<string, string | null> = { status: mapped };
  if (mapped === "live") patch.went_live_at = new Date().toISOString();
  if (mapped === "ended") patch.ended_at = new Date().toISOString();

  const { error, data: updated } = await supabaseAdmin
    .from("auctions")
    .update(patch)
    .eq("basta_sale_id", data.saleId)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error({ err: error, saleId: data.saleId }, "auction status update failed");
    throw error;
  }

  if (!updated) {
    log.warn(
      { saleId: data.saleId, saleStatus: data.saleStatus },
      "SaleStatusChanged for unknown sale — skipping"
    );
    return;
  }

  log.info(
    { auctionId: updated.id, saleId: data.saleId, newStatus: mapped },
    "auction status updated from webhook"
  );
}
