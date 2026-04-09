import type { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "./supabase.js";

export interface SellerProfile {
  id: string;
  tenant_id: string | null;
  is_seller: boolean | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SellerAuthContext {
  userId: string;
  tenantId: string;
  profile: SellerProfile;
}

export interface AuctionOwnershipRecord {
  id: string;
  tenant_id: string;
  status: string | null;
  basta_sale_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string | null;
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export async function requireSeller(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SellerAuthContext | null> {
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, tenant_id, is_seller, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle<SellerProfile>();

  if (profileError || !profile) {
    await reply.status(403).send({ error: "Seller profile not found" });
    return null;
  }

  if (!profile.is_seller || !profile.tenant_id) {
    await reply.status(403).send({ error: "Seller access required" });
    return null;
  }

  return {
    userId: user.id,
    tenantId: profile.tenant_id,
    profile,
  };
}

export async function requireAuctionOwnership(
  auctionId: string,
  tenantId: string
): Promise<AuctionOwnershipRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select("id, tenant_id, status, basta_sale_id, title, description, scheduled_date")
    .eq("id", auctionId)
    .eq("tenant_id", tenantId)
    .maybeSingle<AuctionOwnershipRecord>();

  if (error || !data) {
    return null;
  }

  return data;
}
