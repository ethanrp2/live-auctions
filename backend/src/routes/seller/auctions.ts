import type { FastifyInstance } from "fastify";
import { requireAuctionOwnership, requireSeller } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import {
  getTenantStorefrontAuctionId,
  setTenantStorefrontAuctionId,
} from "../../lib/storefront-auction.js";

interface AuctionRow {
  id: string;
  tenant_id: string;
  basta_sale_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  scheduled_date: string | null;
  current_lot_id: string | null;
  created_at: string;
}

interface LotRow {
  id: string;
  tenant_id: string;
  auction_id: string;
  basta_item_id: string | null;
  title: string;
  description: string | null;
  images: string[] | null;
  condition_report: string | null;
  measurements: string | null;
  year: number | null;
  provenance: string | null;
  item_location: string | null;
  shipping_terms: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  starting_bid: number | null;
  reserve: number | null;
  tags: string[] | null;
  sort_order: number | null;
  status: string | null;
  created_at: string;
}

const auctionSelect =
  "id, tenant_id, basta_sale_id, title, description, status, scheduled_date, current_lot_id, created_at";

const auctionBodySchema = {
  type: "object",
  required: ["title", "scheduled_date"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", maxLength: 10000 },
    scheduled_date: { type: "string", format: "date-time" },
  },
} as const;

const auctionPatchBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", maxLength: 10000 },
    scheduled_date: { type: "string", format: "date-time" },
  },
} as const;

const auctionParamSchema = {
  type: "object",
  required: ["auctionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
  },
} as const;

export async function auctionSellerRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { title: string; description?: string; scheduled_date: string } }>(
    "/auctions",
    {
      schema: {
        body: auctionBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const payload = {
        tenant_id: seller.tenantId,
        title: request.body.title.trim(),
        description: request.body.description?.trim() || null,
        scheduled_date: request.body.scheduled_date,
        status: "draft",
      };

      const { data, error } = await supabaseAdmin
        .from("auctions")
        .insert(payload)
        .select(auctionSelect)
        .single<AuctionRow>();

      if (error) {
        request.log.error({ err: error }, "Failed to create auction");
        return reply.status(500).send({ error: "Failed to create auction" });
      }

      return reply.status(201).send({ auction: data });
    }
  );

  fastify.get("/auctions", async (request, reply) => {
    const seller = await requireSeller(request, reply);
    if (!seller) {
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("auctions")
      .select(auctionSelect)
      .eq("tenant_id", seller.tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      request.log.error({ err: error }, "Failed to list auctions");
      return reply.status(500).send({ error: "Failed to list auctions" });
    }

    const selection = await getTenantStorefrontAuctionId(seller.tenantId);

    if (selection.error) {
      request.log.error(
        { err: selection.error },
        "Failed to load storefront auction selection"
      );
      return reply.status(500).send({ error: "Failed to list auctions" });
    }

    return reply.send({
      auctions: data ?? [],
      storefrontAuctionId: selection.storefrontAuctionId,
    });
  });

  fastify.get<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId",
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

      const { data: lots, error: lotsError } = await supabaseAdmin
        .from("lots")
        .select("*")
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (lotsError) {
        request.log.error({ err: lotsError }, "Failed to load lots for auction");
        return reply.status(500).send({ error: "Failed to load auction lots" });
      }

      return reply.send({
        auction,
        lots: (lots ?? []) as LotRow[],
      });
    }
  );

  fastify.patch<{ Params: { auctionId: string }; Body: { title?: string; description?: string; scheduled_date?: string } }>(
    "/auctions/:auctionId",
    {
      schema: {
        params: auctionParamSchema,
        body: auctionPatchBodySchema,
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

      if (auction.status !== "draft") {
        return reply
          .status(409)
          .send({ error: "Only draft auctions can be updated" });
      }

      const updates: Record<string, string | null> = {};
      if (typeof request.body.title === "string") {
        updates.title = request.body.title.trim();
      }
      if (typeof request.body.description === "string") {
        updates.description = request.body.description.trim();
      }
      if (typeof request.body.scheduled_date === "string") {
        updates.scheduled_date = request.body.scheduled_date;
      }

      const { data, error } = await supabaseAdmin
        .from("auctions")
        .update(updates)
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .select(auctionSelect)
        .single<AuctionRow>();

      if (error || !data) {
        request.log.error({ err: error }, "Failed to update auction");
        return reply.status(500).send({ error: "Failed to update auction" });
      }

      return reply.send({ auction: data });
    }
  );

  fastify.delete<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId",
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

      if (auction.status !== "draft") {
        return reply
          .status(409)
          .send({ error: "Only draft auctions can be deleted" });
      }

      const { error } = await supabaseAdmin
        .from("auctions")
        .delete()
        .eq("id", auction.id)
        .eq("tenant_id", seller.tenantId);

      if (error) {
        request.log.error({ err: error }, "Failed to delete auction");
        return reply.status(500).send({ error: "Failed to delete auction" });
      }

      return reply.status(204).send();
    }
  );

  fastify.post<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId/storefront",
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

      const selection = await setTenantStorefrontAuctionId(
        seller.tenantId,
        auction.id
      );

      if (
        selection.error ||
        selection.storefrontAuctionId !== auction.id
      ) {
        request.log.error(
          { err: selection.error },
          "Failed to set storefront auction"
        );
        return reply
          .status(500)
          .send({ error: "Failed to set storefront auction" });
      }

      return reply.send({
        storefrontAuctionId: selection.storefrontAuctionId,
      });
    }
  );
}
