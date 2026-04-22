import type { FastifyInstance } from "fastify";
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
}
