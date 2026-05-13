import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDisplayNames } from "@/lib/profile-display-names";
import { getTenantBySlug } from "@/lib/tenant";
import { LiveAuctionView } from "./view";

export default async function LiveAuctionPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  await connection();
  const { auctionId } = await params;
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");
  if (!tenantSlug) notFound();

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);
  if (!tenant) notFound();

  const { data: auction } = await supabase
    .from("auctions")
    .select(
      "id, tenant_id, title, basta_sale_id, status, current_lot_id, ended_at, bid_increment_table, closing_time_countdown_ms"
    )
    .eq("id", auctionId)
    .maybeSingle();

  if (!auction || auction.tenant_id !== tenant.id) notFound();

  const { data: lotRows } = await supabase
    .from("lots")
    .select(
      "id, title, images, starting_bid, sort_order, live_status, basta_item_id, estimate_low, estimate_high, description, condition_report, tags, winner_user_id, winning_bid_cents, sold_at"
    )
    .eq("auction_id", auctionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const lots = lotRows ?? [];
  const winnerDisplayNames = await fetchDisplayNames(
    lots
      .map((lot) => lot.winner_user_id)
      .filter((id): id is string => Boolean(id))
  );

  // M4: seller console writes current_lot_id. Until then, fall back to the
  // first non-sold/passed lot in sort order.
  const currentLotId =
    auction.current_lot_id ??
    lots.find(
      (l) =>
        l.live_status !== "sold" &&
        l.live_status !== "passed" &&
        l.live_status !== "closed"
    )?.id ??
    lots[0]?.id ??
    null;

  return (
    <LiveAuctionView
      tenant={{
        name: tenant.name,
        logoUrl: tenant.logo_url,
        primaryColor: tenant.brand_colors?.primary ?? "#000000",
        fontDisplay: tenant.font_display,
        fontMono: tenant.font_mono,
      }}
      auction={{
        id: auction.id,
        title: auction.title,
        status: auction.status,
        endedAt: auction.ended_at,
        bastaSaleId: auction.basta_sale_id,
        bidIncrementTable: auction.bid_increment_table,
        closingTimeCountdownMs: auction.closing_time_countdown_ms,
        currentLotId,
      }}
      lots={lots.map((l) => ({
        id: l.id,
        title: l.title,
        images: l.images ?? [],
        startingBid: l.starting_bid,
        sortOrder: l.sort_order,
        liveStatus: l.live_status,
        bastaItemId: l.basta_item_id,
        estimateLow: l.estimate_low,
        estimateHigh: l.estimate_high,
        description: l.description,
        conditionReport: l.condition_report,
        tags: l.tags ?? [],
        winnerUserId: l.winner_user_id,
        winnerDisplayName: l.winner_user_id
          ? winnerDisplayNames.get(l.winner_user_id) ?? null
          : null,
        winningBidCents: l.winning_bid_cents,
        soldAt: l.sold_at,
      }))}
    />
  );
}
