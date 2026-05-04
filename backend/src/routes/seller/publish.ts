import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuctionOwnership, requireSeller } from "../../lib/auth.js";
import {
  createItemForSale,
  createSale,
  publishSale,
  type CreateItemForSaleInput,
} from "../../lib/basta.js";
import { config } from "../../config.js";
import { supabaseAdmin } from "../../lib/supabase.js";

interface LotRow {
  id: string;
  title: string;
  description: string | null;
  starting_bid: number | null;
  reserve: number | null;
  sort_order: number | null;
  basta_item_id: string | null;
  created_at: string;
}

const publishParamsSchema = {
  type: "object",
  required: ["auctionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
  },
} as const;

const defaultBidIncrementTable = [
  { lowRange: 0, highRange: 100_000, step: 2_500 },
  { lowRange: 100_000, highRange: 5_000_000, step: 10_000 },
];

function mapLotToCreateItemInput(
  lot: LotRow,
  saleId: string,
  openDate: Date,
  closingDate: Date
): CreateItemForSaleInput {
  // lots.starting_bid and lots.reserve are stored in cents; Basta expects cents.
  return {
    saleId,
    title: lot.title,
    description: lot.description ?? "",
    startingBid: lot.starting_bid ?? 0,
    reserve: lot.reserve ?? 0,
    openDate: openDate.toISOString(),
    closingDate: closingDate.toISOString(),
  };
}

function isAlreadyPublishedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return msg.includes("already") && msg.includes("publish");
}

async function acquirePublishLock(
  auctionId: string,
  lockOwner: string
): Promise<"acquired" | "busy" | "error"> {
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  await supabaseAdmin
    .from("auction_publish_locks")
    .delete()
    .eq("auction_id", auctionId)
    .lt("expires_at", nowIso);

  const { error } = await supabaseAdmin.from("auction_publish_locks").insert({
    auction_id: auctionId,
    lock_owner: lockOwner,
    expires_at: expiresAt,
  });

  if (!error) {
    return "acquired";
  }

  if (error.code === "23505") {
    return "busy";
  }

  return "error";
}

async function releasePublishLock(auctionId: string, lockOwner: string) {
  await supabaseAdmin
    .from("auction_publish_locks")
    .delete()
    .eq("auction_id", auctionId)
    .eq("lock_owner", lockOwner);
}

export async function sellerPublishRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId/publish",
    {
      schema: {
        params: publishParamsSchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const auctionId = request.params.auctionId;
      const lockOwner = crypto.randomUUID();
      const lockState = await acquirePublishLock(auctionId, lockOwner);
      if (lockState === "busy") {
        return reply.status(409).send({ error: "Auction publish already in progress" });
      }
      if (lockState === "error") {
        return reply.status(500).send({ error: "Failed to acquire publish lock" });
      }

      try {
        const auction = await requireAuctionOwnership(auctionId, seller.tenantId);
        if (!auction) {
          return reply.status(404).send({ error: "Auction not found" });
        }

        if (auction.status !== "draft") {
          return reply.status(409).send({ error: "Only draft auctions can be published" });
        }

        if (!auction.scheduled_date) {
          return reply.status(422).send({ error: "Auction must have a scheduled_date" });
        }

        const { data: lots, error: lotsError } = await supabaseAdmin
          .from("lots")
          .select("id, title, description, starting_bid, reserve, sort_order, basta_item_id, created_at")
          .eq("auction_id", auction.id)
          .eq("tenant_id", seller.tenantId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (lotsError) {
          request.log.error({ err: lotsError }, "Failed to load lots for publish");
          return reply.status(500).send({ error: "Failed to load lots for publish" });
        }

        const orderedLots = (lots ?? []) as LotRow[];
        if (orderedLots.length === 0) {
          return reply.status(422).send({ error: "Auction must contain at least one lot" });
        }

        for (const lot of orderedLots) {
          if (!lot.title || lot.starting_bid === null) {
            return reply
              .status(422)
              .send({ error: "Each lot must have title and starting_bid before publish" });
          }
        }

        let saleId = auction.basta_sale_id;
        if (!saleId) {
          try {
            const sale = await createSale({
              title: auction.title,
              description: auction.description ?? "",
              closingTimeCountdown: 30_000,
              bidIncrementTable: defaultBidIncrementTable,
            });

            saleId = sale.id;

            const { error: updateSaleError } = await supabaseAdmin
              .from("auctions")
              .update({ basta_sale_id: saleId })
              .eq("id", auction.id)
              .eq("tenant_id", seller.tenantId);

            if (updateSaleError) {
              request.log.error({ err: updateSaleError }, "Failed to persist basta_sale_id");
              return reply.status(500).send({ error: "Failed to persist Basta sale ID" });
            }
          } catch (error) {
            request.log.error({ err: error }, "Basta createSale failed");
            return reply.status(502).send({
              error: "Failed to create Basta sale",
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const auctionStart = new Date(auction.scheduled_date);
        for (const [index, lot] of orderedLots.entries()) {
          if (lot.basta_item_id) {
            continue;
          }

          const openDate = new Date(
            auctionStart.getTime() + index * config.bastaLotDurationMs
          );
          const closingDate = new Date(openDate.getTime() + config.bastaLotDurationMs);

          try {
            const input = mapLotToCreateItemInput(lot, saleId, openDate, closingDate);
            const item = await createItemForSale(input);

            const { error: updateItemError } = await supabaseAdmin
              .from("lots")
              .update({ basta_item_id: item.id })
              .eq("id", lot.id)
              .eq("auction_id", auction.id)
              .eq("tenant_id", seller.tenantId);

            if (updateItemError) {
              request.log.error({ err: updateItemError }, "Failed to persist basta_item_id");
              return reply.status(500).send({ error: "Failed to persist Basta item ID" });
            }
          } catch (error) {
            request.log.error({ err: error }, "Basta createItemForSale failed");
            return reply.status(502).send({
              error: "Failed to create Basta item for lot",
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        }

        try {
          await publishSale(saleId);
        } catch (error) {
          if (!isAlreadyPublishedError(error)) {
            request.log.error({ err: error }, "Basta publishSale failed");
            return reply.status(502).send({
              error: "Failed to publish Basta sale",
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const { error: statusError } = await supabaseAdmin
          .from("auctions")
          .update({ status: "published" })
          .eq("id", auction.id)
          .eq("tenant_id", seller.tenantId);

        if (statusError) {
          request.log.error({ err: statusError }, "Failed to mark auction as published");
          return reply.status(500).send({ error: "Failed to update auction status" });
        }

        return reply.send({
          auctionId: auction.id,
          bastaSaleId: saleId,
          status: "published",
        });
      } finally {
        await releasePublishLock(auctionId, lockOwner);
      }
    }
  );
}
