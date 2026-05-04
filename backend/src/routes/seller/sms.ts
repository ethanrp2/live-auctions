import type { FastifyInstance } from "fastify";
import { requireSeller, requireAuctionOwnership } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { notifyAuctionStarting, notifyLotOnDeck } from "../../lib/sms-triggers.js";

const auctionParamSchema = {
  type: "object",
  required: ["auctionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
  },
} as const;

const lotOnDeckBodySchema = {
  type: "object",
  required: ["lotId"],
  additionalProperties: false,
  properties: {
    lotId: { type: "string", format: "uuid" },
  },
} as const;

interface LotRow {
  id: string;
  title: string;
  sort_order: number | null;
}

export async function sellerSmsRoutes(fastify: FastifyInstance) {
  // POST /api/seller/auctions/:auctionId/notify/start
  fastify.post<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId/notify/start",
    {
      schema: { params: auctionParamSchema },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;

      const auction = await requireAuctionOwnership(request.params.auctionId, seller.tenantId);
      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      void notifyAuctionStarting(auction.id, seller.tenantId, auction.title).catch((err) =>
        request.log.error({ err }, "SMS notifyAuctionStarting failed")
      );

      return reply.send({ ok: true });
    }
  );

  // POST /api/seller/auctions/:auctionId/notify/lot-on-deck
  fastify.post<{ Params: { auctionId: string }; Body: { lotId: string } }>(
    "/auctions/:auctionId/notify/lot-on-deck",
    {
      schema: {
        params: auctionParamSchema,
        body: lotOnDeckBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;

      const auction = await requireAuctionOwnership(request.params.auctionId, seller.tenantId);
      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      const { lotId } = request.body;

      const { data: lot, error: lotError } = await supabaseAdmin
        .from("lots")
        .select("id, title, sort_order")
        .eq("id", lotId)
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .maybeSingle<LotRow>();

      if (lotError || !lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      void notifyLotOnDeck(auction.id, seller.tenantId, lot.title, lot.sort_order ?? 0).catch(
        (err) => request.log.error({ err }, "SMS notifyLotOnDeck failed")
      );

      return reply.send({ ok: true });
    }
  );
}
