import crypto from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { requireSeller } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { config } from "../../config.js";

const bucketName = "lot-images";
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

interface LotWithAuction {
  id: string;
  tenant_id: string;
  auction_id: string;
  images: string[] | null;
  auctions: {
    id: string;
    status: string | null;
  } | null;
}

function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const base = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const safeBase = base || "image";
  const safeExt = ext || ".bin";
  return `${safeBase}${safeExt}`;
}

function extractPathFromPublicUrl(url: string): string | null {
  const prefix = `${config.supabaseUrl}/storage/v1/object/public/${bucketName}/`;
  if (!url.startsWith(prefix)) {
    return null;
  }

  return decodeURIComponent(url.slice(prefix.length));
}

function getCanonicalPublicUrl(filePath: string): string {
  const { data } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

async function getOwnedLot(lotId: string, tenantId: string): Promise<LotWithAuction | null> {
  const { data, error } = await supabaseAdmin
    .from("lots")
    .select("id, tenant_id, auction_id, images, auctions!inner(id, status)")
    .eq("id", lotId)
    .eq("tenant_id", tenantId)
    .maybeSingle<LotWithAuction>();

  if (error || !data) {
    return null;
  }

  return data;
}

const lotParamSchema = {
  type: "object",
  required: ["lotId"],
  properties: {
    lotId: { type: "string", format: "uuid" },
  },
} as const;

const signedUploadBodySchema = {
  type: "object",
  required: ["filename", "contentType"],
  additionalProperties: false,
  properties: {
    filename: { type: "string", minLength: 1, maxLength: 255 },
    contentType: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const confirmBodySchema = {
  type: "object",
  required: ["path", "publicUrl"],
  additionalProperties: false,
  properties: {
    path: { type: "string", minLength: 5, maxLength: 1024 },
    publicUrl: { type: "string", minLength: 1, maxLength: 2048 },
  },
} as const;

const deleteBodySchema = {
  type: "object",
  required: ["url"],
  additionalProperties: false,
  properties: {
    url: { type: "string", minLength: 1, maxLength: 2048 },
  },
} as const;

export async function sellerImageRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { lotId: string }; Body: { filename: string; contentType: string } }>(
    "/lots/:lotId/images/signed-upload",
    {
      schema: {
        params: lotParamSchema,
        body: signedUploadBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      if (!allowedMimeTypes.has(request.body.contentType)) {
        return reply.status(422).send({ error: "Unsupported content type" });
      }

      const lot = await getOwnedLot(request.params.lotId, seller.tenantId);
      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      if (lot.auctions?.status !== "draft") {
        return reply.status(409).send({ error: "Images can only be changed on draft auctions" });
      }

      const safeFilename = sanitizeFilename(request.body.filename);
      const objectPath = `${seller.tenantId}/${lot.id}/${crypto.randomUUID()}-${safeFilename}`;
      const publicUrl = getCanonicalPublicUrl(objectPath);

      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUploadUrl(objectPath, { upsert: false });

      if (error || !data) {
        request.log.error({ err: error }, "Failed to create signed upload URL");
        return reply.status(500).send({ error: "Failed to create signed upload URL" });
      }

      return reply.send({
        bucket: bucketName,
        path: objectPath,
        token: data.token,
        publicUrl,
        expiresIn: config.signedUploadExpiresInSeconds,
      });
    }
  );

  fastify.post<{ Params: { lotId: string }; Body: { path: string; publicUrl: string } }>(
    "/lots/:lotId/images",
    {
      schema: {
        params: lotParamSchema,
        body: confirmBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const lot = await getOwnedLot(request.params.lotId, seller.tenantId);
      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      if (lot.auctions?.status !== "draft") {
        return reply.status(409).send({ error: "Images can only be changed on draft auctions" });
      }

      const expectedPrefix = `${seller.tenantId}/${lot.id}/`;
      if (!request.body.path.startsWith(expectedPrefix)) {
        return reply.status(422).send({ error: "Invalid image path for lot" });
      }

      const canonicalPublicUrl = getCanonicalPublicUrl(request.body.path);
      if (request.body.publicUrl !== canonicalPublicUrl) {
        return reply.status(422).send({ error: "publicUrl does not match path" });
      }

      const folder = request.body.path.slice(0, request.body.path.lastIndexOf("/"));
      const filename = request.body.path.slice(request.body.path.lastIndexOf("/") + 1);

      const { data: files, error: listError } = await supabaseAdmin.storage
        .from(bucketName)
        .list(folder, { search: filename, limit: 1 });

      if (listError) {
        request.log.error({ err: listError }, "Failed to verify uploaded image");
        return reply.status(500).send({ error: "Failed to verify uploaded image" });
      }

      const found = (files ?? []).some((file) => file.name === filename);
      if (!found) {
        return reply.status(422).send({ error: "Uploaded image not found" });
      }

      const nextImages = [...(lot.images ?? [])];
      if (!nextImages.includes(canonicalPublicUrl)) {
        nextImages.push(canonicalPublicUrl);
      }

      const { data: updatedLot, error: updateError } = await supabaseAdmin
        .from("lots")
        .update({ images: nextImages })
        .eq("id", lot.id)
        .eq("tenant_id", seller.tenantId)
        .select("id, images")
        .single<{ id: string; images: string[] | null }>();

      if (updateError || !updatedLot) {
        request.log.error({ err: updateError }, "Failed to append lot image URL");
        return reply.status(500).send({ error: "Failed to append lot image URL" });
      }

      return reply.send({ lotId: updatedLot.id, images: updatedLot.images ?? [] });
    }
  );

  fastify.delete<{ Params: { lotId: string }; Body: { url: string } }>(
    "/lots/:lotId/images",
    {
      schema: {
        params: lotParamSchema,
        body: deleteBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const lot = await getOwnedLot(request.params.lotId, seller.tenantId);
      if (!lot) {
        return reply.status(404).send({ error: "Lot not found" });
      }

      if (lot.auctions?.status !== "draft") {
        return reply.status(409).send({ error: "Images can only be changed on draft auctions" });
      }

      const objectPath = extractPathFromPublicUrl(request.body.url);
      if (!objectPath) {
        return reply.status(422).send({ error: "Invalid public URL" });
      }

      const expectedPrefix = `${seller.tenantId}/${lot.id}/`;
      if (!objectPath.startsWith(expectedPrefix)) {
        return reply.status(403).send({ error: "Image does not belong to seller lot" });
      }

      const canonicalPublicUrl = getCanonicalPublicUrl(objectPath);
      const { error: removeError } = await supabaseAdmin.storage
        .from(bucketName)
        .remove([objectPath]);

      if (
        removeError &&
        !removeError.message.toLowerCase().includes("not found")
      ) {
        request.log.error({ err: removeError }, "Failed to delete image from storage");
        return reply.status(500).send({ error: "Failed to delete image from storage" });
      }

      const nextImages = (lot.images ?? []).filter(
        (url) => url !== request.body.url && url !== canonicalPublicUrl
      );

      const { data: updatedLot, error: updateError } = await supabaseAdmin
        .from("lots")
        .update({ images: nextImages })
        .eq("id", lot.id)
        .eq("tenant_id", seller.tenantId)
        .select("id, images")
        .single<{ id: string; images: string[] | null }>();

      if (updateError || !updatedLot) {
        request.log.error({ err: updateError }, "Failed to remove lot image URL");
        return reply.status(500).send({ error: "Failed to remove lot image URL" });
      }

      return reply.send({ lotId: updatedLot.id, images: updatedLot.images ?? [] });
    }
  );
}
