import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { supabaseAdmin } from "../lib/supabase.js";

interface OnboardSellerBody {
  tenantId?: string;
  tenantSlug?: string;
  displayName?: string;
  email?: string;
  password?: string;
}

function parseOriginHost(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function getSubdomain(hostname: string, rootDomain: string): string | null {
  if (hostname === rootDomain) {
    return null;
  }

  if (hostname.endsWith(`.${rootDomain}`)) {
    return hostname.slice(0, -(rootDomain.length + 1));
  }

  return null;
}

export async function sellerOnboardingRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: OnboardSellerBody }>("/api/seller/onboarding", async (request, reply) => {
    const { tenantId, tenantSlug, displayName, email, password } = request.body ?? {};

    if (!tenantId || !tenantSlug || !displayName || !email || !password) {
      return reply.status(400).send({ error: "Missing required fields" });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: "Password must be at least 6 characters" });
    }

    const origin = request.headers.origin;
    if (!origin) {
      return reply.status(400).send({ error: "Missing origin header" });
    }

    const originHost = parseOriginHost(origin);
    if (!originHost) {
      return reply.status(400).send({ error: "Invalid origin header" });
    }

    const originSubdomain = getSubdomain(originHost, config.rootDomain);
    if (!originSubdomain || originSubdomain !== tenantSlug) {
      return reply.status(403).send({
        error: "Seller onboarding is only allowed from the tenant subdomain",
      });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, slug")
      .eq("id", tenantId)
      .eq("slug", tenantSlug)
      .maybeSingle<{ id: string; slug: string }>();

    if (tenantError || !tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const { count: sellerCount, error: sellerCountError } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("is_seller", true);

    if (sellerCountError) {
      fastify.log.error(sellerCountError, "Failed to check existing seller count");
      return reply.status(500).send({ error: "Failed to validate seller availability" });
    }

    if ((sellerCount ?? 0) >= 1) {
      return reply
        .status(409)
        .send({ error: "This tenant already has a seller account" });
    }

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (createUserError || !createdUser.user) {
      const message = createUserError?.message ?? "Failed to create seller user";
      return reply.status(400).send({ error: message });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: createdUser.user.id,
        display_name: displayName,
        is_seller: true,
        tenant_id: tenant.id,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      fastify.log.error(profileError, "Failed to upsert seller profile");
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
      return reply.status(500).send({ error: "Failed to create seller profile" });
    }

    return reply.status(201).send({
      userId: createdUser.user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });
  });
}
