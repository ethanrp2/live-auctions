import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConsoleView } from "./view";

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  await connection();
  const { auctionId } = await params;

  const supabase = await createClient();

  // Auth check — must be a signed-in seller.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_seller, display_name, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_seller) {
    redirect("/");
  }

  // Fetch auction owned by this seller's tenant.
  const { data: auction } = await supabase
    .from("auctions")
    .select(
      "id, title, status, basta_sale_id, current_lot_id, went_live_at, ended_at, bid_increment_table, closing_time_countdown_ms"
    )
    .eq("id", auctionId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!auction) {
    redirect("/");
  }

  const { data: lotRows } = await supabase
    .from("lots")
    .select(
      "id, title, images, sort_order, live_status, basta_item_id, estimate_low, estimate_high, starting_bid, description, condition_report, measurements, provenance, item_location, shipping_terms"
    )
    .eq("auction_id", auctionId)
    .order("sort_order", { ascending: true });

  const lots = (lotRows ?? []).map((l) => ({
    id: l.id as string,
    title: l.title as string,
    images: (l.images ?? []) as string[],
    sortOrder: l.sort_order as number | null,
    liveStatus: l.live_status as string | null,
    bastaItemId: l.basta_item_id as string | null,
    estimateLow: l.estimate_low as number | null,
    estimateHigh: l.estimate_high as number | null,
    startingBid: l.starting_bid as number | null,
    description: l.description as string | null,
    conditionReport: l.condition_report as string | null,
    measurements: l.measurements as string | null,
    provenance: l.provenance as string | null,
    itemLocation: l.item_location as string | null,
    shippingTerms: l.shipping_terms as string | null,
  }));

  return (
    <ConsoleView
      auction={{
        id: auction.id as string,
        title: auction.title as string,
        status: auction.status as string | null,
        bastaSaleId: auction.basta_sale_id as string | null,
        currentLotId: auction.current_lot_id as string | null,
        wentLiveAt: auction.went_live_at as string | null,
        endedAt: auction.ended_at as string | null,
        bidIncrementTable: auction.bid_increment_table,
        closingTimeCountdownMs: auction.closing_time_countdown_ms as number | null,
      }}
      lots={lots}
      sellerName={profile.display_name ?? "Seller"}
    />
  );
}
