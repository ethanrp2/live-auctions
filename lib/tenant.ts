import { SupabaseClient } from "@supabase/supabase-js";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  brand_colors: Record<string, string>;
}

const cache = new Map<string, { tenant: Tenant; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function getTenantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Tenant | null> {
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > now) {
    return cached.tenant;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, description, logo_url, brand_colors")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  const tenant: Tenant = data;
  cache.set(slug, { tenant, expiresAt: now + CACHE_TTL_MS });
  return tenant;
}
