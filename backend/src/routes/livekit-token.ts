import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { supabaseAdmin } from "../lib/supabase.js";
import { config } from "../config.js";

interface LiveKitTokenBody {
  auctionId: string;
  role: "publisher" | "subscriber";
}

export async function livekitTokenRoutes(fastify: FastifyInstance) {
  fastify.post("/api/livekit-token", async (request, reply) => {
    // ── Body validation ───────────────────────────────────────────────────
    const body = request.body as LiveKitTokenBody;
    if (!body?.auctionId || !body?.role) {
      return reply.status(400).send({ error: "auctionId and role are required" });
    }
    if (body.role !== "publisher" && body.role !== "subscriber") {
      return reply.status(400).send({ error: "role must be publisher or subscriber" });
    }

    const roomName = `auction-${body.auctionId}`;

    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      return reply.status(503).send({
        error:
          "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
      });
    }

    const { data: auction, error: auctionError } = await supabaseAdmin
      .from("auctions")
      .select("id")
      .eq("id", body.auctionId)
      .maybeSingle<{ id: string }>();

    if (auctionError || !auction) {
      return reply.status(404).send({ error: "Auction not found" });
    }

    const authHeader = request.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const {
      data: { user },
      error: userError,
    } = accessToken
      ? await supabaseAdmin.auth.getUser(accessToken)
      : { data: { user: null }, error: null };

    // ── Publisher: must be a seller ───────────────────────────────────────
    if (body.role === "publisher") {
      if (userError || !user) {
        return reply.status(401).send({ error: "Invalid or expired session" });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("is_seller")
        .eq("id", user.id)
        .maybeSingle<{ is_seller: boolean | null }>();

      if (profileError || !profile) {
        return reply.status(403).send({ error: "Profile not found" });
      }
      if (!profile.is_seller) {
        return reply.status(403).send({ error: "Seller access required to publish audio" });
      }
    }

    // ── Mint token ────────────────────────────────────────────────────────
    try {
      const userId = user?.id ?? `guest-${randomUUID()}`;
      const identity = `${body.role}-${userId}-${randomUUID()}`;
      const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity,
        metadata: JSON.stringify({ userId, role: body.role }),
        ttl: "4h",
      });

      if (body.role === "publisher") {
        at.addGrant({
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: false,
        });
      } else {
        at.addGrant({
          roomJoin: true,
          room: roomName,
          canPublish: false,
          canSubscribe: true,
        });
      }

      const token = await at.toJwt();

      return reply.send({
        token,
        roomName,
        livekitUrl: config.livekitUrl,
      });
    } catch (err) {
      fastify.log.error(err, "Failed to mint LiveKit token");
      return reply.status(500).send({ error: "Failed to create LiveKit token" });
    }
  });
}
