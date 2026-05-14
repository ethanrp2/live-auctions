import crypto from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { requireSeller } from "../../lib/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { config } from "../../config.js";

const bucketName = "lot-images";
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedAssetKinds = new Set(["logo", "hero"]);

interface TenantBrandingRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  hero_image_url: string | null;
  brand_colors: Record<string, string> | null;
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

function getCanonicalPublicUrl(filePath: string): string {
  const { data } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

const signedUploadBodySchema = {
  type: "object",
  required: ["filename", "contentType", "kind"],
  additionalProperties: false,
  properties: {
    filename: { type: "string", minLength: 1, maxLength: 255 },
    contentType: { type: "string", minLength: 1, maxLength: 100 },
    kind: { type: "string", enum: ["logo", "hero"] },
  },
} as const;

const tenantBrandingPatchBodySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    logo_url: { type: "string", minLength: 1, maxLength: 2048 },
    hero_image_url: { type: "string", minLength: 1, maxLength: 2048 },
    primary_color: { type: "string", minLength: 7, maxLength: 7 },
  },
} as const;

export async function sellerTenantRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: { filename: string; contentType: string; kind: "logo" | "hero" };
  }>(
    "/tenant/branding/signed-upload",
    {
      schema: {
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

      if (!allowedAssetKinds.has(request.body.kind)) {
        return reply.status(422).send({ error: "Unsupported branding asset type" });
      }

      const safeFilename = sanitizeFilename(request.body.filename);
      const objectPath = `${seller.tenantId}/branding/${request.body.kind}/${crypto.randomUUID()}-${safeFilename}`;
      const publicUrl = getCanonicalPublicUrl(objectPath);

      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUploadUrl(objectPath, { upsert: false });

      if (error || !data) {
        request.log.error({ err: error }, "Failed to create branding upload URL");
        return reply.status(500).send({ error: "Failed to create branding upload URL" });
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

  fastify.patch<{
    Body: {
      logo_url?: string;
      hero_image_url?: string;
      primary_color?: string;
    };
  }>(
    "/tenant/branding",
    {
      schema: {
        body: tenantBrandingPatchBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) {
        return;
      }

      const { data: existingTenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .select("id, slug, name, logo_url, hero_image_url, brand_colors")
        .eq("id", seller.tenantId)
        .single<TenantBrandingRow>();

      if (tenantError || !existingTenant) {
        request.log.error({ err: tenantError }, "Failed to load tenant branding");
        return reply.status(404).send({ error: "Tenant not found" });
      }

      if (
        typeof request.body.primary_color === "string" &&
        !isHexColor(request.body.primary_color)
      ) {
        return reply.status(422).send({ error: "Primary color must be a 6-digit hex value" });
      }

      const updates: {
        logo_url?: string;
        hero_image_url?: string;
        brand_colors?: Record<string, string>;
      } = {};

      if (typeof request.body.logo_url === "string") {
        updates.logo_url = request.body.logo_url;
      }
      if (typeof request.body.hero_image_url === "string") {
        updates.hero_image_url = request.body.hero_image_url;
      }
      if (typeof request.body.primary_color === "string") {
        updates.brand_colors = {
          ...(existingTenant.brand_colors ?? {}),
          primary: request.body.primary_color.toUpperCase(),
        };
      }

      const { data: updatedTenant, error: updateError } = await supabaseAdmin
        .from("tenants")
        .update(updates)
        .eq("id", seller.tenantId)
        .select("id, slug, name, logo_url, hero_image_url, brand_colors")
        .single<TenantBrandingRow>();

      if (updateError || !updatedTenant) {
        request.log.error({ err: updateError }, "Failed to update tenant branding");
        return reply.status(500).send({ error: "Failed to update tenant branding" });
      }

      return reply.send({ tenant: updatedTenant });
    }
  );
}
