import type { FastifyInstance } from "fastify";
import { requireAuctionOwnership, requireSeller } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

interface LotRow {
  id: string;
  live_status: string | null;
  sort_order: number | null;
  created_at: string;
}

async function loadLotsOrdered(auctionId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .select("id, live_status, sort_order, created_at")
    .eq("auction_id", auctionId)
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LotRow[];
}

function pickNextLot(
  lots: LotRow[],
  excludingLotId?: string
): string | null {
  const hit = lots.find((l) => {
    if (l.id === excludingLotId) return false;
    return l.live_status !== "sold" && l.live_status !== "passed";
  });
  return hit?.id ?? null;
}

const auctionParamSchema = {
  type: "object",
  required: ["auctionId"],
  properties: { auctionId: { type: "string", format: "uuid" } },
} as const;

const questionParamSchema = {
  type: "object",
  required: ["questionId"],
  properties: { questionId: { type: "string", format: "uuid" } },
} as const;

const advanceBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    nextLotId: { type: "string", format: "uuid" },
  },
} as const;

const sellBodySchema = {
  type: "object",
  required: ["lotId", "amountCents"],
  additionalProperties: false,
  properties: {
    lotId: { type: "string", format: "uuid" },
    amountCents: { type: "integer", minimum: 0 },
    bidderUserId: { type: ["string", "null"] },
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

export async function sellerConsoleRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId/go-live",
    { schema: { params: auctionParamSchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;
      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );
      if (!auction) return reply.status(404).send({ error: "Auction not found" });

      const lots = await loadLotsOrdered(auction.id, seller.tenantId);
      if (lots.length === 0) {
        return reply.status(422).send({ error: "Auction has no lots" });
      }
      const firstLotId = pickNextLot(lots);
      if (!firstLotId) {
        return reply.status(422).send({ error: "No eligible lots to go live" });
      }

      const { data, error } = await supabaseAdmin
        .from("auctions")
        .update({
          status: "live",
          went_live_at: new Date().toISOString(),
          current_lot_id: firstLotId,
        })
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .select("id, status, went_live_at, current_lot_id")
        .single();
      if (error) {
        request.log.error({ err: error }, "Failed to go live");
        return reply.status(500).send({ error: "Failed to go live" });
      }

      await supabaseAdmin
        .from("lots")
        .update({ live_status: "live" })
        .eq("id", firstLotId);

      return reply.send({ auction: data });
    }
  );

  fastify.post<{
    Params: { auctionId: string };
    Body: { nextLotId?: string };
  }>(
    "/auctions/:auctionId/advance-lot",
    { schema: { params: auctionParamSchema, body: advanceBodySchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;
      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );
      if (!auction) return reply.status(404).send({ error: "Auction not found" });

      let nextLotId = request.body.nextLotId ?? null;
      if (!nextLotId) {
        const lots = await loadLotsOrdered(auction.id, seller.tenantId);
        const currentIdx = lots.findIndex((l) => l.live_status === "live");
        const remaining = currentIdx >= 0 ? lots.slice(currentIdx + 1) : lots;
        const next = remaining.find(
          (l) => l.live_status !== "sold" && l.live_status !== "passed"
        );
        nextLotId = next?.id ?? null;
      }
      if (!nextLotId) {
        return reply.status(422).send({ error: "No eligible next lot" });
      }

      await supabaseAdmin
        .from("auctions")
        .update({ current_lot_id: nextLotId })
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId);

      await supabaseAdmin
        .from("lots")
        .update({ live_status: "live" })
        .eq("id", nextLotId)
        .eq("tenant_id", seller.tenantId);

      return reply.send({ currentLotId: nextLotId });
    }
  );

  fastify.post<{
    Params: { auctionId: string };
    Body: { lotId: string; amountCents: number; bidderUserId?: string | null };
  }>(
    "/auctions/:auctionId/sell-lot",
    { schema: { params: auctionParamSchema, body: sellBodySchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;
      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );
      if (!auction) return reply.status(404).send({ error: "Auction not found" });

      const { lotId, amountCents, bidderUserId } = request.body;

      const { error: lotError } = await supabaseAdmin
        .from("lots")
        .update({
          live_status: "sold",
          winning_bid_cents: amountCents,
          winner_user_id: bidderUserId ?? null,
          sold_at: new Date().toISOString(),
        })
        .eq("id", lotId)
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId);
      if (lotError) {
        request.log.error({ err: lotError }, "Failed to mark lot sold");
        return reply.status(500).send({ error: "Failed to mark lot sold" });
      }

      const lots = await loadLotsOrdered(auction.id, seller.tenantId);
      const nextLotId = pickNextLot(lots, lotId);
      if (nextLotId) {
        await supabaseAdmin
          .from("auctions")
          .update({ current_lot_id: nextLotId })
          .eq("id", auction.id)
          .eq("tenant_id", seller.tenantId);
        await supabaseAdmin
          .from("lots")
          .update({ live_status: "live" })
          .eq("id", nextLotId)
          .eq("tenant_id", seller.tenantId);
      }

      return reply.send({ soldLotId: lotId, nextLotId });
    }
  );

  fastify.post<{
    Params: { auctionId: string };
    Body: { lotId: string };
  }>(
    "/auctions/:auctionId/pass-lot",
    { schema: { params: auctionParamSchema, body: passBodySchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;
      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );
      if (!auction) return reply.status(404).send({ error: "Auction not found" });

      const { lotId } = request.body;

      await supabaseAdmin
        .from("lots")
        .update({
          live_status: "passed",
          sold_at: new Date().toISOString(),
        })
        .eq("id", lotId)
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId);

      const lots = await loadLotsOrdered(auction.id, seller.tenantId);
      const nextLotId = pickNextLot(lots, lotId);
      if (nextLotId) {
        await supabaseAdmin
          .from("auctions")
          .update({ current_lot_id: nextLotId })
          .eq("id", auction.id)
          .eq("tenant_id", seller.tenantId);
        await supabaseAdmin
          .from("lots")
          .update({ live_status: "live" })
          .eq("id", nextLotId)
          .eq("tenant_id", seller.tenantId);
      }

      return reply.send({ passedLotId: lotId, nextLotId });
    }
  );

  fastify.post<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId/end",
    { schema: { params: auctionParamSchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;
      const auction = await requireAuctionOwnership(
        request.params.auctionId,
        seller.tenantId
      );
      if (!auction) return reply.status(404).send({ error: "Auction not found" });

      const { error } = await supabaseAdmin
        .from("auctions")
        .update({
          status: "closed",
          ended_at: new Date().toISOString(),
          current_lot_id: null,
        })
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId);
      if (error) {
        request.log.error({ err: error }, "Failed to end auction");
        return reply.status(500).send({ error: "Failed to end auction" });
      }
      return reply.send({ auctionId: auction.id, status: "closed" });
    }
  );

  fastify.patch<{ Params: { questionId: string } }>(
    "/questions/:questionId/dismiss",
    { schema: { params: questionParamSchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;

      const { data, error } = await supabaseAdmin
        .from("auction_questions")
        .update({ dismissed: true })
        .eq("id", request.params.questionId)
        .eq("tenant_id", seller.tenantId)
        .select("id, dismissed")
        .maybeSingle();
      if (error || !data) {
        return reply.status(404).send({ error: "Question not found" });
      }
      return reply.send({ question: data });
    }
  );
}
