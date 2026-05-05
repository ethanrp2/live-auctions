import type { FastifyInstance } from "fastify";
import { config } from "../../config.js";
import { supabaseAdmin } from "../../lib/supabase.js";

const smsSubscribeBodySchema = {
  type: "object",
  required: ["phone", "tenantId"],
  additionalProperties: false,
  properties: {
    phone: { type: "string", minLength: 1 },
    tenantId: { type: "string", format: "uuid" },
  },
} as const;

// Basic E.164 validation: starts with +, followed by 10-15 digits
const E164_REGEX = /^\+\d{10,15}$/;

export async function buyerSmsRoutes(fastify: FastifyInstance) {
  // POST /api/buyer/sms-subscribe
  fastify.post<{ Body: { phone: string; tenantId: string } }>(
    "/api/buyer/sms-subscribe",
    {
      schema: { body: smsSubscribeBodySchema },
    },
    async (request, reply) => {
      if (!config.smsEnabled) {
        return reply.status(503).send({ error: "SMS alerts are temporarily disabled" });
      }

      const { phone, tenantId } = request.body;

      if (!E164_REGEX.test(phone)) {
        return reply
          .status(400)
          .send({ error: "Invalid phone number. Use E.164 format (e.g. +12125551234)." });
      }

      const { error } = await supabaseAdmin
        .from("sms_subscribers")
        .upsert(
          { phone_number: phone, tenant_id: tenantId },
          { onConflict: "phone_number,tenant_id" }
        );

      if (error) {
        request.log.error({ err: error }, "Failed to upsert SMS subscriber");
        return reply.status(500).send({ error: "Failed to subscribe" });
      }

      return reply.send({ ok: true });
    }
  );
}
