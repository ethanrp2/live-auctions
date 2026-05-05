import type { FastifyInstance } from "fastify";
import { AccessToken } from "livekit-server-sdk";
import { supabaseAdmin } from "../lib/supabase.js";
import { config } from "../config.js";

interface LiveKitTokenBody {
  auctionId: string;
  role: "publisher" | "subscriber";
}

export async function livekitTokenRoutes(fastify: FastifyInstance) {
  fastify.post("/api/livekit-token", async (request, reply) => {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing authorization header" });
    }
    const accessToken = authHeader.slice(7).trim();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return reply.status(401).send({ error: "Invalid or expired session" });
    }

    // ── Body validation ───────────────────────────────────────────────────
    const body = request.body as LiveKitTokenBody;
    if (!body?.auctionId || !body?.role) {
      return reply.status(400).send({ error: "auctionId and role are required" });
    }
    if (body.role !== "publisher" && body.role !== "subscriber") {
      return reply.status(400).send({ error: "role must be publisher or subscriber" });
    }

    const roomName = `auction-${body.auctionId}`;

    // ── Publisher: must be a seller ───────────────────────────────────────
    if (body.role === "publisher") {
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
      const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity: user.id,
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
