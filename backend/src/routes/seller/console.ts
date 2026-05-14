import type { FastifyInstance } from "fastify";
import { requireSeller, requireAuctionOwnership } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { notifyWinner } from "../../lib/sms-triggers.js";

const auctionParamSchema = {
  type: "object",
  required: ["auctionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
  },
} as const;

const currentLotBodySchema = {
  type: "object",
  required: ["lotId"],
  additionalProperties: false,
  properties: {
    lotId: { type: "string", format: "uuid" },
  },
} as const;

const sellBodySchema = {
  type: "object",
  required: ["lotId", "winnerUserId", "salePriceCents"],
  additionalProperties: false,
  properties: {
    lotId: { type: "string", format: "uuid" },
    winnerUserId: { type: "string", format: "uuid" },
    salePriceCents: { type: "integer", minimum: 0 },
  },
} as const;

const passBodySchema = {
  type: "object",
  required: ["lotId"],
  additionalProperties: false,
  properties: {
    lotId: { type: "string", format: "uuid" },
  },
} as const;

async function verifyLotOwnership(
  lotId: string,
  auctionId: string,
  tenantId: string
): Promise<{ id: string; title: string; sort_order: number | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .select("id, title, sort_order")
    .eq("id", lotId)
    .eq("auction_id", auctionId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; title: string; sort_order: number | null }>();

  if (error || !data) {
    return null;
  }

  return data;
}

function isEndedAuction(status: string | null): boolean {
  return status === "ended" || status === "closed";
}

export async function consoleSellerRoutes(fastify: FastifyInstance) {
  // PATCH /api/auctions/:auctionId/current-lot
  fastify.patch<{ Params: { auctionId: string }; Body: { lotId: string } }>(
    "/api/auctions/:auctionId/current-lot",
    {
      schema: {
        params: auctionParamSchema,
        body: currentLotBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }
      if (isEndedAuction(auction.status)) {
        return reply.status(409).send({ error: "Auction has ended" });
      }

      const { lotId } = request.body;

      const lot = await verifyLotOwnership(lotId, auction.id, seller.tenantId);
      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      // Fetch went_live_at separately — it's not on the ownership record
      const { data: auctionMeta } = await supabaseAdmin
        .from("auctions")
        .select("went_live_at")
        .eq("id", auction.id)
        .single<{ went_live_at: string | null }>();

      const auctionUpdates: Record<string, unknown> = {
        current_lot_id: lotId,
        status: "live",
      };
      if (!auctionMeta?.went_live_at) {
        auctionUpdates.went_live_at = new Date().toISOString();
      }

      const { error: auctionError } = await supabaseAdmin
        .from("auctions")
        .update(auctionUpdates)
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId);

      if (auctionError) {
        request.log.error({ err: auctionError }, "Failed to update current lot");
        return reply.status(500).send({ error: "Failed to update current lot" });
      }

      const { error: resetLotsError } = await supabaseAdmin
        .from("lots")
        .update({ live_status: "upcoming" })
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .in("live_status", ["upcoming", "live", "closing"]);

      if (resetLotsError) {
        request.log.error({ err: resetLotsError }, "Failed to reset lot statuses");
        return reply.status(500).send({ error: "Failed to reset lot statuses" });
      }

      if (lot.sort_order !== null) {
        const { error: skippedLotsError } = await supabaseAdmin
          .from("lots")
          .update({ live_status: "passed" })
          .eq("auction_id", auction.id)
          .eq("tenant_id", seller.tenantId)
          .lt("sort_order", lot.sort_order)
          .in("live_status", ["upcoming", "live", "closing"]);

        if (skippedLotsError) {
          request.log.error({ err: skippedLotsError }, "Failed to pass skipped lots");
          return reply.status(500).send({ error: "Failed to pass skipped lots" });
        }
      }

      const { error: lotError } = await supabaseAdmin
        .from("lots")
        .update({ live_status: "live" })
        .eq("id", lotId)
        .eq("tenant_id", seller.tenantId);

      if (lotError) {
        request.log.error({ err: lotError }, "Failed to update lot live_status");
        return reply.status(500).send({ error: "Failed to update lot status" });
      }

      return reply.send({ ok: true, currentLotId: lotId });
    }
  );

  // POST /api/auctions/:auctionId/sell
  fastify.post<{
    Params: { auctionId: string };
    Body: { lotId: string; winnerUserId: string; salePriceCents: number };
  }>(
    "/api/auctions/:auctionId/sell",
    {
      schema: {
        params: auctionParamSchema,
        body: sellBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }
      if (isEndedAuction(auction.status)) {
        return reply.status(409).send({ error: "Auction has ended" });
      }

      const { lotId, winnerUserId, salePriceCents } = request.body;

      const lot = await verifyLotOwnership(lotId, auction.id, seller.tenantId);
      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      const now = new Date().toISOString();

      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          tenant_id: seller.tenantId,
          lot_id: lotId,
          buyer_id: winnerUserId,
          sale_price: salePriceCents,
          payment_status: "pending",
          shipping_status: "pending",
        })
        .select("id")
        .single<{ id: string }>();

      if (orderError || !order) {
        request.log.error({ err: orderError }, "Failed to create order");
        return reply.status(500).send({ error: "Failed to record sale" });
      }

      const { error: lotError } = await supabaseAdmin
        .from("lots")
        .update({
          winner_user_id: winnerUserId,
          winning_bid_cents: salePriceCents,
          sold_at: now,
          live_status: "sold",
        })
        .eq("id", lotId)
        .eq("tenant_id", seller.tenantId);

      if (lotError) {
        request.log.error({ err: lotError }, "Failed to stamp lot as sold");
        return reply.status(500).send({ error: "Failed to stamp lot as sold" });
      }

      // Fire-and-forget SMS — don't let failure break the sell flow
      void notifyWinner(winnerUserId, seller.tenantId, lot.title, salePriceCents).catch((err) =>
        request.log.error({ err }, "SMS notify winner failed")
      );

      return reply.status(201).send({ ok: true, orderId: order.id });
    }
  );

  // POST /api/auctions/:auctionId/pass
  fastify.post<{ Params: { auctionId: string }; Body: { lotId: string } }>(
    "/api/auctions/:auctionId/pass",
    {
      schema: {
        params: auctionParamSchema,
        body: passBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }
      if (isEndedAuction(auction.status)) {
        return reply.status(409).send({ error: "Auction has ended" });
      }

      const { lotId } = request.body;

      const lot = await verifyLotOwnership(lotId, auction.id, seller.tenantId);
      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      const { error } = await supabaseAdmin
        .from("lots")
        .update({ live_status: "passed" })
        .eq("id", lotId)
        .eq("tenant_id", seller.tenantId);

      if (error) {
        request.log.error({ err: error }, "Failed to pass lot");
        return reply.status(500).send({ error: "Failed to pass lot" });
      }

      return reply.send({ ok: true });
    }
  );

  // POST /api/auctions/:auctionId/end
  fastify.post<{ Params: { auctionId: string } }>(
    "/api/auctions/:auctionId/end",
    {
      schema: {
        params: auctionParamSchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      const endedAt = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("auctions")
        .update({
          status: "ended",
          ended_at: endedAt,
        })
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId);

      if (error) {
        request.log.error({ err: error }, "Failed to end auction");
        return reply.status(500).send({ error: "Failed to end auction" });
      }

      const { data: auctionMeta, error: metaError } = await supabaseAdmin
        .from("auctions")
        .select("current_lot_id")
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .single<{ current_lot_id: string | null }>();

      if (metaError) {
        request.log.error({ err: metaError }, "Failed to load auction close state");
        return reply.status(500).send({ error: "Failed to finalize auction state" });
      }

      let currentSortOrder: number | null = null;

      if (auctionMeta.current_lot_id) {
        const currentLot = await verifyLotOwnership(
          auctionMeta.current_lot_id,
          auction.id,
          seller.tenantId
        );
        currentSortOrder = currentLot?.sort_order ?? null;

        if (currentSortOrder !== null) {
          const { error: skippedLotsError } = await supabaseAdmin
            .from("lots")
            .update({ live_status: "passed" })
            .eq("auction_id", auction.id)
            .eq("tenant_id", seller.tenantId)
            .lt("sort_order", currentSortOrder)
            .in("live_status", ["upcoming", "live", "closing"]);

          if (skippedLotsError) {
            request.log.error({ err: skippedLotsError }, "Failed to pass skipped lots");
            return reply.status(500).send({ error: "Failed to pass skipped lots" });
          }
        }
      }

      let closeLotsQuery = supabaseAdmin
        .from("lots")
        .update({ live_status: "closed" })
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .in("live_status", ["upcoming", "live", "closing"]);

      if (currentSortOrder !== null) {
        closeLotsQuery = closeLotsQuery.gte("sort_order", currentSortOrder);
      }

      const { error: lotsError } = await closeLotsQuery;

      if (lotsError) {
        request.log.error({ err: lotsError }, "Failed to close remaining lots");
        return reply.status(500).send({ error: "Failed to close remaining lots" });
      }

      return reply.send({ ok: true, endedAt });
    }
  );

  // POST /api/auctions/:auctionId/restart
  fastify.post<{ Params: { auctionId: string } }>(
    "/api/auctions/:auctionId/restart",
    {
      schema: {
        params: auctionParamSchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      const { data: auctionMeta, error: metaError } = await supabaseAdmin
        .from("auctions")
        .select("current_lot_id")
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .single<{ current_lot_id: string | null }>();

      if (metaError) {
        request.log.error({ err: metaError }, "Failed to load auction restart state");
        return reply.status(500).send({ error: "Failed to restart auction" });
      }

      const currentLotId = auctionMeta.current_lot_id;
      if (currentLotId) {
        const lot = await verifyLotOwnership(currentLotId, auction.id, seller.tenantId);
        if (!lot) {
          return reply.status(404).send({ error: "Current lot not found" });
        }
      }

      const wentLiveAt = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("auctions")
        .update({
          status: "live",
          went_live_at: wentLiveAt,
          ended_at: null,
        })
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId);

      if (error) {
        request.log.error({ err: error }, "Failed to restart auction");
        return reply.status(500).send({ error: "Failed to restart auction" });
      }

      if (currentLotId) {
        const { error: resetLotsError } = await supabaseAdmin
          .from("lots")
          .update({ live_status: "upcoming" })
          .eq("auction_id", auction.id)
          .eq("tenant_id", seller.tenantId)
          .in("live_status", ["upcoming", "live", "closing", "closed"]);

        if (resetLotsError) {
          request.log.error({ err: resetLotsError }, "Failed to reset lot statuses");
          return reply.status(500).send({ error: "Failed to reset lot statuses" });
        }

        const { error: lotError } = await supabaseAdmin
          .from("lots")
          .update({ live_status: "live" })
          .eq("id", currentLotId)
          .eq("tenant_id", seller.tenantId);

        if (lotError) {
          request.log.error({ err: lotError }, "Failed to reopen current lot");
          return reply.status(500).send({ error: "Failed to reopen current lot" });
        }
      }

      return reply.send({ ok: true, currentLotId, wentLiveAt });
    }
  );

  // GET /api/auctions/:auctionId/winners
  fastify.get<{ Params: { auctionId: string } }>(
    "/api/auctions/:auctionId/winners",
    {
      schema: {
        params: auctionParamSchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );

      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      interface SoldLotRow {
        id: string;
        title: string;
        sort_order: number | null;
        winning_bid_cents: number | null;
        sold_at: string | null;
        winner_user_id: string | null;
      }

      const { data: soldLots, error: lotsError } = await supabaseAdmin
        .from("lots")
        .select("id, title, sort_order, winning_bid_cents, sold_at, winner_user_id")
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .eq("live_status", "sold")
        .order("sort_order", { ascending: true });

      if (lotsError) {
        request.log.error({ err: lotsError }, "Failed to load sold lots");
        return reply.status(500).send({ error: "Failed to load winners" });
      }

      if (!soldLots || soldLots.length === 0) {
        return reply.send({ winners: [] });
      }

      interface ProfileRow {
        id: string;
        display_name: string | null;
        shipping_address: unknown | null;
      }

      const winnerUserIds = [
        ...new Set(
          (soldLots as SoldLotRow[])
            .map((l) => l.winner_user_id)
            .filter((id): id is string => id !== null)
        ),
      ];

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, shipping_address")
        .in("id", winnerUserIds);

      if (profilesError) {
        request.log.error({ err: profilesError }, "Failed to load winner profiles");
        return reply.status(500).send({ error: "Failed to load winner profiles" });
      }

      const profileMap = new Map<string, ProfileRow>();
      for (const p of (profiles ?? []) as ProfileRow[]) {
        profileMap.set(p.id, p);
      }

      const emailMap = new Map<string, string | null>();
      await Promise.all(
        winnerUserIds.map(async (userId) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
          emailMap.set(userId, data?.user?.email ?? null);
        })
      );

      const winners = (soldLots as SoldLotRow[]).map((lot) => {
        const profile = lot.winner_user_id ? profileMap.get(lot.winner_user_id) : undefined;
        const email = lot.winner_user_id ? (emailMap.get(lot.winner_user_id) ?? null) : null;

        return {
          lotId: lot.id,
          lotTitle: lot.title,
          sortOrder: lot.sort_order,
          winningBidCents: lot.winning_bid_cents,
          soldAt: lot.sold_at,
          buyerDisplayName: profile?.display_name ?? null,
          buyerEmail: email,
          buyerShippingAddress: profile?.shipping_address ?? null,
        };
      });

      return reply.send({ winners });
    }
  );
}
