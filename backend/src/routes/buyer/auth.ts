import type { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../../lib/supabase.js";

export interface BuyerAuthContext {
  userId: string;
  email: string | null;
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export async function requireBuyer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<BuyerAuthContext | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    await reply.status(401).send({ error: "Missing authorization header" });
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    await reply.status(401).send({ error: "Invalid or expired session" });
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
  };
}
