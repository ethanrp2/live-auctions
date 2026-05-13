import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../../lib/supabase.js";
import { requireBuyer } from "./auth.js";

interface BuyerShippingAddress {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

interface BuyerProfileRow {
  shipping_address: unknown | null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeShippingAddress(value: unknown): BuyerShippingAddress {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    street1: normalizeString(record.street1),
    street2: normalizeString(record.street2),
    city: normalizeString(record.city),
    state: normalizeString(record.state),
    postalCode: normalizeString(record.postalCode),
  };
}

const shippingAddressPayloadSchema = {
  type: "object",
  required: ["shippingAddress"],
  additionalProperties: false,
  properties: {
    shippingAddress: {
      type: "object",
      additionalProperties: false,
      properties: {
        street1: { type: "string", maxLength: 200 },
        street2: { type: "string", maxLength: 200 },
        city: { type: "string", maxLength: 120 },
        state: { type: "string", maxLength: 120 },
        postalCode: { type: "string", maxLength: 40 },
      },
    },
  },
} as const;

function hasSavedAddress(address: BuyerShippingAddress): boolean {
  return Boolean(
    address.street1 ||
      address.street2 ||
      address.city ||
      address.state ||
      address.postalCode
  );
}

export async function buyerProfileRoutes(fastify: FastifyInstance) {
  await fastify.register(
    async (buyer) => {
      buyer.get("/profile", async (request, reply) => {
        const auth = await requireBuyer(request, reply);
        if (!auth) return;

        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("shipping_address")
          .eq("id", auth.userId)
          .maybeSingle<BuyerProfileRow>();

        if (error) {
          request.log.error({ err: error }, "Failed to load buyer profile");
          return reply.status(500).send({ error: "Failed to load buyer profile" });
        }

        const shippingAddress = normalizeShippingAddress(data?.shipping_address);

        return reply.send({
          shippingAddress,
          hasSavedAddress: hasSavedAddress(shippingAddress),
        });
      });

      buyer.put<{ Body: { shippingAddress: BuyerShippingAddress } }>(
        "/profile",
        {
          schema: {
            body: shippingAddressPayloadSchema,
          },
        },
        async (request, reply) => {
          const auth = await requireBuyer(request, reply);
          if (!auth) return;

          const shippingAddress = normalizeShippingAddress(
            request.body.shippingAddress
          );

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({ shipping_address: shippingAddress })
            .eq("id", auth.userId);

          if (error) {
            request.log.error({ err: error }, "Failed to update buyer profile");
            return reply
              .status(500)
              .send({ error: "Failed to update buyer profile" });
          }

          return reply.send({
            ok: true,
            shippingAddress,
            hasSavedAddress: hasSavedAddress(shippingAddress),
          });
        }
      );
    },
    { prefix: "/api/buyer" }
  );
}
