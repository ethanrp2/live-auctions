import type { FastifyInstance, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { stripe } from "../lib/stripe.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { config } from "../config.js";

interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer | string;
}

function getRawBody(request: RawBodyRequest): Buffer {
  if (request.rawBody) {
    return Buffer.isBuffer(request.rawBody)
      ? request.rawBody
      : Buffer.from(request.rawBody);
  }
  // Fallback: re-stringify the parsed body. This works only if the parser
  // preserves byte-for-byte representation (it usually does NOT). The
  // dedicated buffer parser registered for this route below is the
  // primary mechanism — this fallback exists only for safety.
  return Buffer.from(JSON.stringify(request.body));
}

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // Register a buffer-style content-type parser for the Stripe webhook.
  // Stripe sends `application/json`, but signature verification needs the
  // exact byte stream. We override the JSON parser inside this encapsulated
  // plugin scope so other routes keep using Fastify's default JSON parser.
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      try {
        const buf = body as Buffer;
        const parsed = buf.length > 0 ? JSON.parse(buf.toString("utf8")) : {};
        (_request as RawBodyRequest).rawBody = buf;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  fastify.post(
    "/api/webhooks/stripe",
    async (request: RawBodyRequest, reply) => {
      const signature = request.headers["stripe-signature"];
      if (typeof signature !== "string") {
        return reply.status(400).send({ error: "Missing Stripe signature" });
      }

      let event: Stripe.Event;
      try {
        const rawBody = getRawBody(request);
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          config.stripeWebhookSecret
        );
      } catch (err) {
        request.log.error({ err }, "Stripe webhook signature verification failed");
        return reply.status(400).send({ error: "Invalid signature" });
      }

      try {
        switch (event.type) {
          case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.order_id;
            if (orderId) {
              const { error } = await supabaseAdmin
                .from("orders")
                .update({ payment_status: "paid" })
                .eq("id", orderId);
              if (error) {
                request.log.error(
                  { err: error, orderId },
                  "Failed to mark order paid"
                );
              }
            } else {
              request.log.warn(
                { paymentIntentId: paymentIntent.id },
                "payment_intent.succeeded missing order_id metadata"
              );
            }
            break;
          }
          case "setup_intent.succeeded": {
            // No-op: payment method is already attached to the customer
            // via stripe.confirmCardSetup on the client.
            break;
          }
          default:
            request.log.info(
              { type: event.type },
              "Unhandled Stripe event type"
            );
        }

        return reply.send({ received: true });
      } catch (err) {
        request.log.error({ err, type: event.type }, "Stripe webhook handler threw");
        return reply.status(500).send({ error: "Handler failed" });
      }
    }
  );
}
