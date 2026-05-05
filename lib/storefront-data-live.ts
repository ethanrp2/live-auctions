/**
 * Server-side reads for the live buyer screen. Returns the auction, its lots in
 * ribbon order, and the tenant, or null if not found / not accessible for a buyer.
 */

import { createClient } from "@/lib/supabase/server";

export interface LiveAuctionData {
  tenant: {
    id: string;
    subdomain: string;
    name: string;
  };
  auction: {
    id: string;
    title: string;
    status: string;
    scheduledDate: string | null;
    wentLiveAt: string | null;
    currentLotId: string | null;
    bastaSaleId: string | null;
    bidIncrementTable: unknown;
    closingTimeCountdownMs: number | null;
  };
  lots: Array<{
    id: string;
    sortOrder: number;
    title: string;
    description: string | null;
    imageUrls: string[] | null;
    startingBidCents: number;
    estimateLowCents: number | null;
    estimateHighCents: number | null;
    bastaItemId: string | null;
    liveStatus: string | null;
  }>;
}

export async function fetchLiveAuction(params: {
  tenantSubdomain: string;
  auctionId: string;
}): Promise<LiveAuctionData | null> {
  const supabase = await createClient();

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", params.tenantSubdomain)
    .maybeSingle();

  if (!tenantRow) return null;

  const { data: auctionRow } = await supabase
    .from("auctions")
    .select(
      "id, title, status, scheduled_date, went_live_at, current_lot_id, basta_sale_id, bid_increment_table, closing_time_countdown_ms"
    )
    .eq("id", params.auctionId)
    .eq("tenant_id", tenantRow.id)
    .in("status", ["published", "live", "ended"])
    .maybeSingle();

  if (!auctionRow) return null;

  const { data: lotRows } = await supabase
    .from("lots")
    .select(
      "id, sort_order, title, description, images, starting_bid, estimate_low, estimate_high, basta_item_id, live_status"
    )
    .eq("auction_id", auctionRow.id)
    .order("sort_order", { ascending: true });

  const lots: LiveAuctionData["lots"] = (lotRows ?? []).map((row) => ({
    id: row.id,
    sortOrder: row.sort_order ?? 0,
    title: row.title,
    description: row.description,
    imageUrls: row.images,
    startingBidCents: row.starting_bid ?? 0,
    estimateLowCents: row.estimate_low,
    estimateHighCents: row.estimate_high,
    bastaItemId: row.basta_item_id,
    liveStatus: row.live_status,
  }));

  return {
    tenant: {
      id: tenantRow.id,
      subdomain: tenantRow.slug,
      name: tenantRow.name,
    },
    auction: {
      id: auctionRow.id,
      title: auctionRow.title,
      status: auctionRow.status ?? "draft",
      scheduledDate: auctionRow.scheduled_date,
      wentLiveAt: auctionRow.went_live_at,
      currentLotId: auctionRow.current_lot_id,
      bastaSaleId: auctionRow.basta_sale_id,
      bidIncrementTable: auctionRow.bid_increment_table,
      closingTimeCountdownMs: auctionRow.closing_time_countdown_ms,
    },
    lots,
  };
}
