import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { config } from "../config.js";
import { bidOnItemWithToken, createBidderToken } from "../lib/basta.js";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * GET /api/basta/bid-support/:lotId
 *
 * Returns everything the client needs to place a bid on a lot without knowing
 * Basta's internal id shape:
 *   - saleId        Basta sale id (auctions.basta_sale_id)
 *   - itemId        Basta item id (lots.basta_item_id)
 *   - allowedBidTypes  [MAX, NORMAL] per M1 — we always publish both
 *   - bidIncrementTable  array of {lowRange, highRange, step} in cents
 *   - closingTimeCountdownMs  for anti-snipe countdown rendering
 *   - startingBidCents  lot's starting bid (used when no bids yet)
 *
 * Auth: no Supabase auth required — the data is all public. Client API bid
 * placement separately requires the bidder JWT token via /api/basta-token.
 *
 * 404 cases:
 *   - lot doesn't exist
 *   - lot has no basta_item_id yet (auction not published)
 *   - parent auction has no basta_sale_id yet
 */

interface LotSupportRow {
  id: string;
  tenant_id: string;
  auction_id: string;
  basta_item_id: string | null;
  starting_bid: number | null;
  auctions: {
    id: string;
    basta_sale_id: string | null;
    status: string | null;
    bid_increment_table: unknown;
    closing_time_countdown_ms: number | null;
  } | null;
}

const paramsSchema = {
  type: "object",
  required: ["lotId"],
  properties: {
    lotId: { type: "string", format: "uuid" },
  },
} as const;

const bidBodySchema = {
  type: "object",
  required: ["saleId", "itemId", "amountCents", "type"],
  additionalProperties: false,
  properties: {
    saleId: { type: "string", minLength: 1 },
    itemId: { type: "string", minLength: 1 },
    amountCents: { type: "integer", minimum: 0 },
    type: { type: "string", enum: ["MAX", "NORMAL"] },
  },
} as const;

interface BidLotRow {
  id: string;
  tenant_id: string;
  auction_id: string;
  basta_item_id: string | null;
  starting_bid: number | null;
  auctions: {
    id: string;
    basta_sale_id: string | null;
    status: string | null;
  } | null;
}

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

export async function bastaBidSupportRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { lotId: string } }>(
    "/api/basta/bid-support/:lotId",
    { schema: { params: paramsSchema } },
    async (request, reply) => {
      const { lotId } = request.params;

      const { data, error } = await supabaseAdmin
        .from("lots")
        .select(
          `id, tenant_id, auction_id, basta_item_id, starting_bid,
           auctions:auctions!lots_auction_id_fkey ( id, basta_sale_id, status, bid_increment_table, closing_time_countdown_ms )`
        )
        .eq("id", lotId)
        .maybeSingle<LotSupportRow>();

      if (error) {
        request.log.error({ err: error, lotId }, "bid-support lookup failed");
        return reply.status(500).send({ error: "Failed to load lot" });
      }

      if (!data) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      const auction = data.auctions;
      if (!auction) {
        return reply.status(404).send({ error: "Lot has no parent auction" });
      }

      if (!data.basta_item_id || !auction.basta_sale_id) {
        return reply
          .status(409)
          .send({ error: "Lot has not been published to Basta yet" });
      }

      return reply.send({
        saleId: auction.basta_sale_id,
        itemId: data.basta_item_id,
        allowedBidTypes: ["MAX", "NORMAL"] as const,
        bidIncrementTable: auction.bid_increment_table ?? null,
        closingTimeCountdownMs: auction.closing_time_countdown_ms ?? null,
        startingBidCents: data.starting_bid ?? 0,
        auctionStatus: auction.status,
      });
    }
  );

  fastify.post<{
    Body: {
      saleId: string;
      itemId: string;
      amountCents: number;
      type: "MAX" | "NORMAL";
    };
  }>(
    "/api/basta/bid",
    { schema: { body: bidBodySchema } },
    async (request, reply) => {
      const accessToken = getBearerToken(request.headers.authorization);
      if (!accessToken) {
        return reply.status(401).send({ error: "Missing authorization header" });
      }

      const {
        data: { user },
        error: userError,
      } = await supabaseAdmin.auth.getUser(accessToken);

      if (userError || !user) {
        return reply.status(401).send({ error: "Invalid or expired session" });
      }

      const { saleId, itemId, amountCents, type } = request.body;

      const { data: lot, error: lotError } = await supabaseAdmin
        .from("lots")
        .select(
          `id, tenant_id, auction_id, basta_item_id, starting_bid,
           auctions:auctions!lots_auction_id_fkey ( id, basta_sale_id, status )`
        )
        .eq("basta_item_id", itemId)
        .maybeSingle<BidLotRow>();

      if (lotError) {
        request.log.error({ err: lotError, itemId }, "bid lot lookup failed");
        return reply.status(500).send({ error: "Failed to load lot" });
      }

      const auction = lot?.auctions;
      if (!lot || !auction || auction.basta_sale_id !== saleId) {
        return reply.status(404).send({ error: "Lot not found for sale" });
      }

      if (!["published", "live"].includes(auction.status ?? "")) {
        return reply.status(409).send({ error: "Auction is not accepting bids" });
      }

      if (amountCents < (lot.starting_bid ?? 0)) {
        return reply.status(422).send({ error: "Bid is below the starting bid" });
      }

      const bidderToken = await createBidderToken(
        user.id,
        config.bastaBidderTokenTtlMinutes
      );

      const result = await bidOnItemWithToken({
        bidderToken: bidderToken.token,
        saleId,
        itemId,
        amount: amountCents,
        type,
      });

      if (!result.ok) {
        return reply.status(422).send(result);
      }

      const placedAt = new Date(result.date);
      const placedAtIso = Number.isNaN(placedAt.getTime())
        ? new Date().toISOString()
        : placedAt.toISOString();

      const { error: insertError } = await supabaseAdmin.from("bids").upsert(
        {
          tenant_id: lot.tenant_id,
          auction_id: lot.auction_id,
          lot_id: lot.id,
          user_id: user.id,
          basta_bid_id: `local:${crypto.randomUUID()}`,
          amount_cents: result.amount,
          max_amount_cents: Math.max(amountCents, result.amount),
          bid_type: type,
          reactive: false,
          placed_at: placedAtIso,
        },
        { onConflict: "basta_bid_id", ignoreDuplicates: true }
      );

      if (insertError) {
        request.log.error({ err: insertError, itemId }, "bid mirror insert failed");
        return reply.status(500).send({ error: "Bid placed but failed to mirror locally" });
      }

      return reply.send({
        ok: true,
        amount: result.amount,
        bidStatus: result.bidStatus,
        date: result.date,
        bidType: type,
      });
    }
  );
}
