import { createClient } from "@/lib/supabase/server";

export interface LiveLot {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  tags: string[];
  condition_report: string | null;
  measurements: string | null;
  year: number | null;
  provenance: string | null;
  item_location: string | null;
  shipping_terms: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  starting_bid: number | null;
  reserve: number | null;
  sort_order: number | null;
  basta_item_id: string | null;
  live_status: "upcoming" | "live" | "sold" | "passed" | null;
  winner_user_id: string | null;
  winning_bid_cents: number | null;
  sold_at: string | null;
}

export interface LiveAuctionData {
  auction: {
    id: string;
    tenant_id: string;
    title: string;
    description: string | null;
    status: string;
    scheduled_date: string | null;
    basta_sale_id: string | null;
    current_lot_id: string | null;
    went_live_at: string | null;
    ended_at: string | null;
  };
  lots: LiveLot[];
}

const lotSelect =
  "id, title, description, images, tags, condition_report, measurements, year, provenance, item_location, shipping_terms, estimate_low, estimate_high, starting_bid, reserve, sort_order, basta_item_id, live_status, winner_user_id, winning_bid_cents, sold_at";

const auctionSelect =
  "id, tenant_id, title, description, status, scheduled_date, basta_sale_id, current_lot_id, went_live_at, ended_at";

async function hydrateLots(auctionId: string): Promise<LiveLot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lots")
    .select(lotSelect)
    .eq("auction_id", auctionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data ?? []) as LiveLot[]).map((row) => ({
    ...row,
    images: row.images ?? [],
    tags: row.tags ?? [],
  }));
}

export async function getLiveAuctionForTenant(
  tenantId: string
): Promise<LiveAuctionData | null> {
  const supabase = await createClient();
  const { data: auctionRow } = await supabase
    .from("auctions")
    .select(auctionSelect)
    .eq("tenant_id", tenantId)
    .eq("status", "live")
    .order("went_live_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!auctionRow) return null;
  const lots = await hydrateLots(auctionRow.id);
  return {
    auction: { ...auctionRow },
    lots,
  };
}

/**
 * Console-side fetch: returns the tenant's auction regardless of status
 * (draft / published / live / closed), preferring most recently relevant.
 */
export async function getConsoleAuctionForTenant(
  tenantId: string
): Promise<LiveAuctionData | null> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("auctions")
    .select(auctionSelect)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (!rows || rows.length === 0) return null;
  const live = rows.find((a) => a.status === "live");
  const published = rows.find((a) => a.status === "published");
  const draft = rows.find((a) => a.status === "draft");
  const chosen = live ?? published ?? draft ?? rows[0];
  const lots = await hydrateLots(chosen.id);
  return {
    auction: { ...chosen },
    lots,
  };
}
