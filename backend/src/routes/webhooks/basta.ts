import type { FastifyInstance, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../../lib/supabase.js";
import { handleBidOnItem } from "../../lib/webhook-handlers/bid-on-item.js";
import { handleSaleStatusChanged } from "../../lib/webhook-handlers/sale-status.js";
import { handleItemsStatusChanged } from "../../lib/webhook-handlers/items-status.js";
import type { BastaWebhookPayload } from "../../lib/webhook-handlers/types.js";

/**
 * POST /api/webhooks/basta
 *
 * Inbound Basta webhook sink. Three event types per
 * references/webhooks.md: BidOnItem, SaleStatusChanged, ItemsStatusChanged.
 *
 * Contract:
 *   - Accept + acknowledge within 10s (Basta retries on non-2xx).
 *   - Dedupe by idempotencyKey via the webhook_events table
 *     (PK=idempotency_key, so duplicate inserts are a clean rejection).
 *   - On handler failure, persist error + return 500 so Basta retries.
 *
 * Signature verification: NOT IMPLEMENTED yet — Basta's signing spec is
 * "under construction" (open question Q5 in risks/basta-questions.md).
 * Until then we (a) require BASTA_WEBHOOK_SECRET to match a shared-secret
 * header if one is configured, and (b) rely on a non-guessable URL.
 * This is intentionally weak; tighten once Basta publishes the spec.
 */

interface WebhookEventInsert {
  idempotency_key: string;
  action_type: string;
  payload: unknown;
  basta_sale_id: string | null;
  basta_item_id: string | null;
}

function extractIds(payload: BastaWebhookPayload): {
  saleId: string | null;
  itemId: string | null;
} {
  switch (payload.actionType) {
    case "BidOnItem":
      return { saleId: payload.data.saleId, itemId: payload.data.itemId };
    case "SaleStatusChanged":
      return { saleId: payload.data.saleId, itemId: null };
    case "ItemsStatusChanged":
      return {
        saleId: payload.data.saleId,
        // Pick the first item id for denormalized logging; the full set is
        // in the payload jsonb.
        itemId: payload.data.itemStatusChanges[0]?.itemId ?? null,
      };
  }
}

function isBastaWebhookPayload(p: unknown): p is BastaWebhookPayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (typeof o.idempotencyKey !== "string") return false;
  if (typeof o.actionType !== "string") return false;
  if (!o.data || typeof o.data !== "object") return false;
  return ["BidOnItem", "SaleStatusChanged", "ItemsStatusChanged"].includes(
    o.actionType
  );
}

export async function bastaWebhookRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/webhooks/basta",
    async (
      request: FastifyRequest<{ Body: unknown; Headers: Record<string, string | undefined> }>,
      reply
    ) => {
      // Shared-secret gate (optional; skipped if BASTA_WEBHOOK_SECRET unset).
      const secret = process.env.BASTA_WEBHOOK_SECRET;
      if (secret) {
        const provided =
          request.headers["x-basta-secret"] ??
          request.headers["x-webhook-secret"];
        if (provided !== secret) {
          request.log.warn(
            { provided: typeof provided },
            "rejected webhook: bad or missing secret"
          );
          return reply.status(401).send({ error: "Unauthorized" });
        }
      }

      const body = request.body;
      if (!isBastaWebhookPayload(body)) {
        request.log.warn(
          { body: typeof body === "object" ? Object.keys(body ?? {}) : body },
          "rejected webhook: bad shape"
        );
        return reply.status(400).send({ error: "Malformed payload" });
      }

      const { saleId, itemId } = extractIds(body);

      // Idempotency: try to insert a webhook_events row. If PK conflicts
      // (duplicate delivery) we bail with 200 so Basta stops retrying.
      const row: WebhookEventInsert = {
        idempotency_key: body.idempotencyKey,
        action_type: body.actionType,
        payload: body,
        basta_sale_id: saleId,
        basta_item_id: itemId,
      };

      const { error: insertErr } = await supabaseAdmin
        .from("webhook_events")
        .insert(row);

      if (insertErr) {
        // 23505 = unique_violation (already processed or being processed).
        if ((insertErr as { code?: string }).code === "23505") {
          request.log.info(
            { idempotencyKey: body.idempotencyKey },
            "duplicate webhook — acknowledging"
          );
          return reply.status(200).send({ status: "duplicate" });
        }
        request.log.error(
          { err: insertErr, idempotencyKey: body.idempotencyKey },
          "failed to record webhook event"
        );
        return reply.status(500).send({ error: "record failed" });
      }

      // Dispatch. On success, stamp processed_at. On failure, stamp error
      // and return 500 so Basta retries. The event row stays so we have
      // an audit trail either way.
      try {
        switch (body.actionType) {
          case "BidOnItem":
            await handleBidOnItem(body.data, request.log);
            break;
          case "SaleStatusChanged":
            await handleSaleStatusChanged(body.data, request.log);
            break;
          case "ItemsStatusChanged":
            await handleItemsStatusChanged(body.data, request.log);
            break;
        }

        await supabaseAdmin
          .from("webhook_events")
          .update({ processed_at: new Date().toISOString() })
          .eq("idempotency_key", body.idempotencyKey);

        return reply.status(200).send({ status: "ok" });
      } catch (err) {
        // Supabase client errors are plain { message, code, details, hint }
        // objects, not Error instances — grab .message first, fall back to
        // JSON-stringifying the whole thing so we don't end up with
        // "[object Object]" in the audit trail.
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : JSON.stringify(err);

        request.log.error(
          { err, idempotencyKey: body.idempotencyKey },
          "webhook handler threw"
        );

        await supabaseAdmin
          .from("webhook_events")
          .update({ error: message })
          .eq("idempotency_key", body.idempotencyKey);

        return reply.status(500).send({ error: "handler failed" });
      }
    }
  );
}
