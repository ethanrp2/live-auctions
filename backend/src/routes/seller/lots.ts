import type { FastifyInstance } from "fastify";
import { requireAuctionOwnership, requireSeller } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

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

const uuidParamSchema = {
  type: "object",
  properties: {
    auctionId: { type: "string", format: "uuid" },
    lotId: { type: "string", format: "uuid" },
  },
  required: ["auctionId"],
} as const;

const lotCreateBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 300 },
    description: { type: "string", maxLength: 10000 },
    images: { type: "array", items: { type: "string" }, maxItems: 100 },
    condition_report: { type: "string", maxLength: 10000 },
    measurements: { type: "string", maxLength: 1000 },
    year: { type: "integer", minimum: 0, maximum: 9999 },
    provenance: { type: "string", maxLength: 5000 },
    item_location: { type: "string", maxLength: 1000 },
    shipping_terms: { type: "string", maxLength: 5000 },
    estimate_low: { type: "integer", minimum: 0 },
    estimate_high: { type: "integer", minimum: 0 },
    starting_bid: { type: "integer", minimum: 0 },
    reserve: { type: "integer", minimum: 0 },
    tags: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 100 },
    status: { type: "string", enum: ["upcoming", "live", "sold", "passed"] },
  },
} as const;

const lotPatchBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: lotCreateBodySchema.properties,
} as const;

const reorderBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["lot_ids"],
  properties: {
    lot_ids: {
      type: "array",
      minItems: 1,
      items: { type: "string", format: "uuid" },
    },
  },
} as const;

async function getLot(
  lotId: string,
  auctionId: string,
  tenantId: string
): Promise<LotRow | null> {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .select("*")
    .eq("id", lotId)
    .eq("auction_id", auctionId)
    .eq("tenant_id", tenantId)
    .maybeSingle<LotRow>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function lotSellerRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { auctionId: string }; Body: Record<string, unknown> }>(
    "/auctions/:auctionId/lots",
    {
      schema: {
        params: uuidParamSchema,
        body: lotCreateBodySchema,
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
        return reply.status(409).send({ error: "Lots can only be changed on draft auctions" });
      }

      const { data: lastLot, error: sortError } = await supabaseAdmin
        .from("lots")
        .select("sort_order")
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle<{ sort_order: number | null }>();

      if (sortError) {
        request.log.error({ err: sortError }, "Failed to calculate lot order");
        return reply.status(500).send({ error: "Failed to create lot" });
      }

      const nextSort = (lastLot?.sort_order ?? -1) + 1;
      const payload: Record<string, unknown> = {
        ...request.body,
        title: String(request.body.title).trim(),
        tenant_id: seller.tenantId,
        auction_id: auction.id,
        sort_order: nextSort,
      };

      const { data, error } = await supabaseAdmin
        .from("lots")
        .insert(payload)
        .select("*")
        .single<LotRow>();

      if (error || !data) {
        request.log.error({ err: error }, "Failed to create lot");
        return reply.status(500).send({ error: "Failed to create lot" });
      }

      return reply.status(201).send({ lot: data });
    }
  );

  fastify.get<{ Params: { auctionId: string } }>(
    "/auctions/:auctionId/lots",
    {
      schema: {
        params: uuidParamSchema,
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

      const { data, error } = await supabaseAdmin
        .from("lots")
        .select("*")
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        request.log.error({ err: error }, "Failed to list lots");
        return reply.status(500).send({ error: "Failed to list lots" });
      }

      return reply.send({ lots: (data ?? []) as LotRow[] });
    }
  );

  fastify.patch<{ Params: { auctionId: string; lotId: string }; Body: Record<string, unknown> }>(
    "/auctions/:auctionId/lots/:lotId",
    {
      schema: {
        params: { ...uuidParamSchema, required: ["auctionId", "lotId"] },
        body: lotPatchBodySchema,
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
        return reply.status(409).send({ error: "Lots can only be changed on draft auctions" });
      }

      const lot = await getLot(
        request.params.lotId,
        request.params.auctionId,
        seller.tenantId
      );

      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      const updates: Record<string, unknown> = { ...request.body };
      if (typeof updates.title === "string") {
        updates.title = updates.title.trim();
      }

      const { data, error } = await supabaseAdmin
        .from("lots")
        .update(updates)
        .eq("id", lot.id)
        .eq("auction_id", request.params.auctionId)
        .eq("tenant_id", seller.tenantId)
        .select("*")
        .single<LotRow>();

      if (error || !data) {
        request.log.error({ err: error }, "Failed to update lot");
        return reply.status(500).send({ error: "Failed to update lot" });
      }

      return reply.send({ lot: data });
    }
  );

  fastify.delete<{ Params: { auctionId: string; lotId: string } }>(
    "/auctions/:auctionId/lots/:lotId",
    {
      schema: {
        params: { ...uuidParamSchema, required: ["auctionId", "lotId"] },
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
        return reply.status(409).send({ error: "Lots can only be changed on draft auctions" });
      }

      const lot = await getLot(
        request.params.lotId,
        request.params.auctionId,
        seller.tenantId
      );

      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      const { error } = await supabaseAdmin
        .from("lots")
        .delete()
        .eq("id", lot.id)
        .eq("auction_id", request.params.auctionId)
        .eq("tenant_id", seller.tenantId);

      if (error) {
        request.log.error({ err: error }, "Failed to delete lot");
        return reply.status(500).send({ error: "Failed to delete lot" });
      }

      return reply.status(204).send();
    }
  );

  fastify.patch<{ Params: { auctionId: string }; Body: { lot_ids: string[] } }>(
    "/auctions/:auctionId/lots/reorder",
    {
      schema: {
        params: uuidParamSchema,
        body: reorderBodySchema,
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
        return reply.status(409).send({ error: "Lots can only be changed on draft auctions" });
      }

      const { data: lots, error: lotsError } = await supabaseAdmin
        .from("lots")
        .select("id")
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId);

      if (lotsError) {
        request.log.error({ err: lotsError }, "Failed to validate lot reorder payload");
        return reply.status(500).send({ error: "Failed to reorder lots" });
      }

      const existingIds = new Set((lots ?? []).map((lot) => lot.id));
      const requestedIds = request.body.lot_ids;

      if (existingIds.size !== requestedIds.length) {
        return reply.status(422).send({
          error: "lot_ids must include each lot in this auction exactly once",
        });
      }

      const seenIds = new Set<string>();
      for (const lotId of requestedIds) {
        if (seenIds.has(lotId) || !existingIds.has(lotId)) {
          return reply.status(422).send({
            error: "lot_ids must include each lot in this auction exactly once",
          });
        }
        seenIds.add(lotId);
      }

      const rows = requestedIds.map((id, index) => ({
        id,
        auction_id: auction.id,
        tenant_id: seller.tenantId,
        sort_order: index,
      }));

      const { error } = await supabaseAdmin
        .from("lots")
        .upsert(rows, { onConflict: "id" });

      if (error) {
        request.log.error({ err: error }, "Failed to reorder lots");
        return reply.status(500).send({ error: "Failed to reorder lots" });
      }

      return reply.send({ reordered: requestedIds.length });
    }
  );
}
