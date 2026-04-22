import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * GET /api/auctions/:auctionId/current-state
 *
 * One-shot hydration for the buyer live screen. The frontend calls this on
 * mount, then subscribes to Supabase Realtime (public.bids, public.lots,
 * public.auctions) + Basta Client-API WS for delta updates.
 *
 * Response shape is the single source of truth — coordinated with the
 * frontend's `lib/basta/ws.ts` and `useSaleActivity`/`useBidFeed` hooks.
 *
 * Public read. The underlying data is already publicly readable via RLS for
 * auctions in status published/live/ended/closed; this endpoint surfaces it
 * in a single round-trip.
 *
 * 404 if auction doesn't exist or is still a draft (draft auctions leak no
 * data to buyers).
 */

const RECENT_BIDS_PER_LOT = 20;

const paramsSchema = {
  type: "object",
  required: ["auctionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
  },
} as const;

interface AuctionRow {
  id: string;
  tenant_id: string;
  basta_sale_id: string | null;
  title: string;
  status: string | null;
  scheduled_date: string | null;
  current_lot_id: string | null;
  went_live_at: string | null;
  ended_at: string | null;
  bid_increment_table: unknown;
  closing_time_countdown_ms: number | null;
}

interface LotRow {
  id: string;
  auction_id: string;
  basta_item_id: string | null;
  title: string;
  description: string | null;
  images: string[] | null;
  sort_order: number | null;
  starting_bid: number | null;
  reserve: number | null;
  live_status: string | null;
  winner_user_id: string | null;
  winning_bid_cents: number | null;
  sold_at: string | null;
}

interface BidRow {
  id: string;
  lot_id: string;
  user_id: string | null;
  amount_cents: number;
  max_amount_cents: number;
  bid_type: "MAX" | "NORMAL";
  reactive: boolean;
  placed_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}

export async function auctionCurrentStateRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { auctionId: string } }>(
    "/api/auctions/:auctionId/current-state",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      const { auctionId } = request.params;

      const { data: auction, error: auctionError } = await supabaseAdmin
        .from("auctions")
        .select(
          "id, tenant_id, basta_sale_id, title, status, scheduled_date, current_lot_id, went_live_at, ended_at, bid_increment_table, closing_time_countdown_ms"
        )
        .eq("id", auctionId)
        .maybeSingle<AuctionRow>();

      if (auctionError) {
        request.log.error({ err: auctionError, auctionId }, "current-state: auction lookup failed");
        return reply.status(500).send({ error: "Failed to load auction" });
      }

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      // Drafts leak no data to buyers.
      if (!auction.status || auction.status === "draft") {
        return reply.status(404).send({ error: "Auction not found" });
      }

      const { data: lotsData, error: lotsError } = await supabaseAdmin
        .from("lots")
        .select(
          "id, auction_id, basta_item_id, title, description, images, sort_order, starting_bid, reserve, live_status, winner_user_id, winning_bid_cents, sold_at"
        )
        .eq("auction_id", auction.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (lotsError) {
        request.log.error({ err: lotsError, auctionId }, "current-state: lots lookup failed");
        return reply.status(500).send({ error: "Failed to load lots" });
      }

      const lots = (lotsData ?? []) as LotRow[];

      // Fetch last N bids per lot. We pull the union across the auction and
      // bucket client-side. For M3 auctions have <=30 lots and <=20 bids per
      // lot, so this is bounded. If an auction ever grows large, switch to a
      // ROW_NUMBER() window via rpc.
      let bids: BidRow[] = [];
      if (lots.length > 0) {
        const { data: bidsData, error: bidsError } = await supabaseAdmin
          .from("bids")
          .select(
            "id, lot_id, user_id, amount_cents, max_amount_cents, bid_type, reactive, placed_at"
          )
          .eq("auction_id", auction.id)
          .order("placed_at", { ascending: false })
          .limit(RECENT_BIDS_PER_LOT * lots.length);

        if (bidsError) {
          request.log.error({ err: bidsError, auctionId }, "current-state: bids lookup failed");
          return reply.status(500).send({ error: "Failed to load bids" });
        }
        bids = (bidsData ?? []) as BidRow[];
      }

      // Resolve display names for any users that appear in the bid feed.
      const userIds = Array.from(
        new Set(bids.map((b) => b.user_id).filter((u): u is string => !!u))
      );
      const profilesById = new Map<string, string | null>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        for (const p of (profiles ?? []) as ProfileRow[]) {
          profilesById.set(p.id, p.display_name);
        }
      }

      const recentBidsByLot: Record<string, Array<{
        id: string;
        userId: string | null;
        userDisplayName: string | null;
        amountCents: number;
        maxAmountCents: number;
        bidType: "MAX" | "NORMAL";
        reactive: boolean;
        placedAt: string;
      }>> = {};
      for (const lot of lots) recentBidsByLot[lot.id] = [];
      for (const b of bids) {
        const bucket = recentBidsByLot[b.lot_id];
        if (!bucket || bucket.length >= RECENT_BIDS_PER_LOT) continue;
        bucket.push({
          id: b.id,
          userId: b.user_id,
          userDisplayName: b.user_id ? profilesById.get(b.user_id) ?? null : null,
          amountCents: b.amount_cents,
          maxAmountCents: b.max_amount_cents,
          bidType: b.bid_type,
          reactive: b.reactive,
          placedAt: b.placed_at,
        });
      }

      return reply.send({
        auctionId: auction.id,
        bastaSaleId: auction.basta_sale_id,
        title: auction.title,
        status: auction.status,
        scheduledDate: auction.scheduled_date,
        currentLotId: auction.current_lot_id,
        wentLiveAt: auction.went_live_at,
        endedAt: auction.ended_at,
        bidIncrementTable: auction.bid_increment_table ?? null,
        closingTimeCountdownMs: auction.closing_time_countdown_ms ?? null,
        lots: lots.map((lot) => ({
          id: lot.id,
          bastaItemId: lot.basta_item_id,
          title: lot.title,
          description: lot.description,
          images: lot.images ?? [],
          sortOrder: lot.sort_order,
          startingBidCents: lot.starting_bid ?? 0,
          reserveCents: lot.reserve,
          liveStatus: lot.live_status,
          winnerUserId: lot.winner_user_id,
          winningBidCents: lot.winning_bid_cents,
          soldAt: lot.sold_at,
        })),
        recentBidsByLot,
      });
    }
  );
}
