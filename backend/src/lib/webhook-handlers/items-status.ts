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

const LOCAL_TERMINAL_STATUSES = new Set(["sold", "passed"]);

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

    const { data: current, error: lookupError } = await supabaseAdmin
      .from("lots")
      .select("id, live_status")
      .eq("basta_item_id", change.itemId)
      .maybeSingle<{ id: string; live_status: string | null }>();

    if (lookupError) {
      log.error(
        { err: lookupError, itemId: change.itemId },
        "lot live_status lookup failed"
      );
      throw lookupError;
    }

    if (!current) {
      log.warn(
        { itemId: change.itemId, itemStatus: change.itemStatus },
        "ItemsStatusChanged for unknown item — skipping"
      );
      continue;
    }

    if (LOCAL_TERMINAL_STATUSES.has(current.live_status ?? "")) {
      log.info(
        {
          lotId: current.id,
          itemId: change.itemId,
          currentLiveStatus: current.live_status,
          webhookLiveStatus: mapped,
        },
        "preserving local terminal lot status over Basta webhook"
      );
      continue;
    }

    const { error } = await supabaseAdmin
      .from("lots")
      .update({ live_status: mapped })
      .eq("id", current.id)
      .select("id");

    if (error) {
      log.error(
        { err: error, itemId: change.itemId },
        "lot live_status update failed"
      );
      throw error;
    }

    log.info(
      {
        lotId: current.id,
        itemId: change.itemId,
        liveStatus: mapped,
      },
      "lot live_status updated from webhook"
    );
  }
}
