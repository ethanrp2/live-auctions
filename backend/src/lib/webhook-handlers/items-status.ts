import type { FastifyBaseLogger } from "fastify";
import { supabaseAdmin } from "../supabase.js";
import type { BastaItemsStatusChangedData } from "./types.js";

/**
 * Basta enum -> our lots.live_status.
 *
 * `lots.live_status` is an internal "what's this lot doing right now" hint
 * used by the seller console + live buyer screen. Current known values in
 * use: 'upcoming' | 'live' | 'closing' | 'sold' | 'passed' | 'closed'.
 *
 * We only write values we get from Basta. SOLD / PASSED come from the
 * seller console (M4), not from this webhook.
 */
const LIVE_STATUS_MAP: Record<string, string | null> = {
  UNPUBLISHED: "upcoming",
  PUBLISHED: "upcoming",
  OPEN: "live",
  CLOSING: "closing",
  CLOSED: "closed",
};

export async function handleItemsStatusChanged(
  data: BastaItemsStatusChangedData,
  log: FastifyBaseLogger
): Promise<void> {
  for (const change of data.itemStatusChanges) {
    const mapped = LIVE_STATUS_MAP[change.itemStatus];
    if (mapped == null) {
      log.warn(
        { itemStatus: change.itemStatus, itemId: change.itemId },
        "unknown itemStatus — skipping"
      );
      continue;
    }

    const { error, data: updated } = await supabaseAdmin
      .from("lots")
      .update({ live_status: mapped })
      .eq("basta_item_id", change.itemId)
      .select("id")
      .maybeSingle();

    if (error) {
      log.error(
        { err: error, itemId: change.itemId },
        "lot live_status update failed"
      );
      throw error;
    }

    if (!updated) {
      log.warn(
        { itemId: change.itemId, itemStatus: change.itemStatus },
        "ItemsStatusChanged for unknown item — skipping"
      );
      continue;
    }

    log.info(
      {
        lotId: updated.id,
        itemId: change.itemId,
        liveStatus: mapped,
      },
      "lot live_status updated from webhook"
    );
  }
}
