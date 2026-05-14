import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { config } from "../config.js";
import {
  bidOnItemWithToken,
  createBidderToken,
  createItemForSale,
  createSale,
  publishSale,
  type BidIncrementRule,
} from "../lib/basta.js";
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
  title: string;
  description: string | null;
  starting_bid: number | null;
  reserve: number | null;
  live_status: string | null;
  auctions: {
    id: string;
    basta_sale_id: string | null;
    status: string | null;
    ended_at: string | null;
    current_lot_id: string | null;
    title: string;
    description: string | null;
    scheduled_date: string | null;
    bid_increment_table: unknown;
    closing_time_countdown_ms: number | null;
  } | null;
}

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

function isBastaNotOpenError(result: { ok: false; errorCode: string; error: string }) {
  return (
    result.errorCode === "ITEM_NOT_OPEN" ||
    result.error.includes("ITEM_NOT_OPEN") ||
    result.error.includes("not allowed for item in status")
  );
}

function coerceBidIncrementTable(raw: unknown): BidIncrementRule[] {
  if (!Array.isArray(raw)) {
    return [
      { lowRange: 0, highRange: 100_000, step: 2_500 },
      { lowRange: 100_000, highRange: 5_000_000, step: 10_000 },
    ];
  }

  const rules = raw.filter((item): item is BidIncrementRule => {
    return (
      !!item &&
      typeof item === "object" &&
      typeof (item as BidIncrementRule).lowRange === "number" &&
      typeof (item as BidIncrementRule).highRange === "number" &&
      typeof (item as BidIncrementRule).step === "number"
    );
  });

  return rules.length > 0
    ? rules
    : [
        { lowRange: 0, highRange: 100_000, step: 2_500 },
        { lowRange: 100_000, highRange: 5_000_000, step: 10_000 },
      ];
}

async function recreateLiveBastaSaleForAuction(
  auction: NonNullable<BidLotRow["auctions"]>,
  tenantId: string
): Promise<{ saleId: string; itemIdByLotId: Map<string, string> }> {
  interface LotRow {
    id: string;
    title: string;
    description: string | null;
    starting_bid: number | null;
    reserve: number | null;
    sort_order: number | null;
    created_at: string;
  }

  const { data: lots, error: lotsError } = await supabaseAdmin
    .from("lots")
    .select("id, title, description, starting_bid, reserve, sort_order, created_at")
    .eq("auction_id", auction.id)
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lotsError) {
    throw lotsError;
  }

  const orderedLots = (lots ?? []) as LotRow[];
  if (orderedLots.length === 0) {
    throw new Error("Cannot recreate Basta sale without lots");
  }

  const closingTimeCountdown =
    auction.closing_time_countdown_ms == null
      ? 30_000
      : auction.closing_time_countdown_ms;
  const bidIncrementTable = coerceBidIncrementTable(auction.bid_increment_table);
  const sale = await createSale({
    title: auction.title,
    description: auction.description ?? "",
    closingTimeCountdown,
    bidIncrementTable,
  });

  const now = Date.now();
  const scheduled = auction.scheduled_date
    ? new Date(auction.scheduled_date).getTime()
    : now;
  const closeAnchor = Math.max(Number.isFinite(scheduled) ? scheduled : now, now);
  const itemIdByLotId = new Map<string, string>();

  for (const [index, lot] of orderedLots.entries()) {
    const item = await createItemForSale({
      saleId: sale.id,
      title: lot.title,
      description: lot.description ?? "",
      startingBid: lot.starting_bid ?? 0,
      reserve: lot.reserve ?? 0,
      openDate: new Date(now - 60_000).toISOString(),
      closingDate: new Date(
        closeAnchor + (index + 1) * config.bastaLotDurationMs
      ).toISOString(),
      allowedBidTypes: ["MAX", "NORMAL"],
    });
    itemIdByLotId.set(lot.id, item.id);
  }

  await publishSale(sale.id);

  const { error: auctionUpdateError } = await supabaseAdmin
    .from("auctions")
    .update({
      basta_sale_id: sale.id,
      bid_increment_table: bidIncrementTable,
      closing_time_countdown_ms: closingTimeCountdown,
    })
    .eq("id", auction.id)
    .eq("tenant_id", tenantId);

  if (auctionUpdateError) {
    throw auctionUpdateError;
  }

  const updateResults = await Promise.all(
    [...itemIdByLotId.entries()].map(([lotId, itemId]) =>
      supabaseAdmin
        .from("lots")
        .update({ basta_item_id: itemId })
        .eq("id", lotId)
        .eq("tenant_id", tenantId)
    )
  );
  const failedUpdate = updateResults.find((result) => result.error);
  if (failedUpdate?.error) {
    throw failedUpdate.error;
  }

  return { saleId: sale.id, itemIdByLotId };
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

      let { saleId, itemId } = request.body;
      const { amountCents, type } = request.body;

      const { data: lot, error: lotError } = await supabaseAdmin
        .from("lots")
        .select(
          `id, tenant_id, auction_id, basta_item_id, title, description, starting_bid, reserve, live_status,
           auctions:auctions!lots_auction_id_fkey (
             id,
             basta_sale_id,
             status,
             ended_at,
             current_lot_id,
             title,
             description,
             scheduled_date,
             bid_increment_table,
             closing_time_countdown_ms
           )`
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
      if (auction.ended_at) {
        return reply.status(409).send({ error: "This auction has ended" });
      }
      if (type === "NORMAL" && auction.status !== "live") {
        return reply.status(409).send({ error: "Live bidding has not started yet" });
      }
      if (lot.live_status && ["sold", "passed", "closed"].includes(lot.live_status)) {
        return reply.status(409).send({ error: "This lot is no longer accepting bids" });
      }
      if (type === "NORMAL" && lot.live_status !== "live" && lot.live_status !== "closing") {
        return reply.status(409).send({ error: "The seller has not opened this lot for live bidding yet" });
      }

      if (amountCents < (lot.starting_bid ?? 0)) {
        return reply.status(422).send({ error: "Bid is below the starting bid" });
      }

      const bidderToken = await createBidderToken(
        user.id,
        config.bastaBidderTokenTtlMinutes
      );

      let result = await bidOnItemWithToken({
        bidderToken: bidderToken.token,
        saleId,
        itemId,
        amount: amountCents,
        type,
      });

      if (
        !result.ok &&
        type === "NORMAL" &&
        isBastaNotOpenError(result) &&
        auction.status === "live" &&
        auction.current_lot_id === lot.id &&
        (lot.live_status === "live" || lot.live_status === "closing")
      ) {
        try {
          const recreated = await recreateLiveBastaSaleForAuction(
            auction,
            lot.tenant_id
          );
          const nextItemId = recreated.itemIdByLotId.get(lot.id);
          if (nextItemId) {
            saleId = recreated.saleId;
            itemId = nextItemId;
            result = await bidOnItemWithToken({
              bidderToken: bidderToken.token,
              saleId,
              itemId,
              amount: amountCents,
              type,
            });
          }
        } catch (error) {
          request.log.error(
            { err: error, auctionId: auction.id, lotId: lot.id },
            "Failed to recreate live Basta sale after ITEM_NOT_OPEN"
          );
        }
      }

      if (!result.ok) {
        return reply.status(422).send(result);
      }

      const placedAt = new Date(result.date);
      const placedAtIso = Number.isNaN(placedAt.getTime())
        ? new Date().toISOString()
        : placedAt.toISOString();
      const mirroredAmountCents =
        typeof result.amount === "number" && Number.isFinite(result.amount)
          ? result.amount
          : amountCents;
      const mirroredMaxAmountCents =
        type === "MAX"
          ? Math.max(amountCents, mirroredAmountCents)
          : mirroredAmountCents;

      const { error: insertError } = await supabaseAdmin.from("bids").upsert(
        {
          tenant_id: lot.tenant_id,
          auction_id: lot.auction_id,
          lot_id: lot.id,
          user_id: user.id,
          basta_bid_id: `local:${crypto.randomUUID()}`,
          amount_cents: mirroredAmountCents,
          max_amount_cents: mirroredMaxAmountCents,
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
        amount: mirroredAmountCents,
        bidStatus: result.bidStatus,
        date: result.date,
        bidType: type,
      });
    }
  );
}
