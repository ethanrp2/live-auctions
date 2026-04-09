import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";
import { createBidderToken } from "../lib/basta.js";
import { config } from "../config.js";

export async function bastaTokenRoutes(fastify: FastifyInstance) {
  fastify.post("/api/basta-token", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing authorization header" });
    }
    const accessToken = authHeader.slice(7);

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) {
      return reply.status(401).send({ error: "Invalid or expired session" });
    }

    try {
      const result = await createBidderToken(
        user.id,
        config.bastaBidderTokenTtlMinutes
      );
      return reply.send({
        token: result.token,
        expiration: result.expiration,
      });
    } catch (err) {
      fastify.log.error(err, "Failed to create Basta bidder token");
      return reply.status(502).send({ error: "Failed to create bidder token" });
    }
  });
}
