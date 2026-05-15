import { supabaseAdmin } from "./supabase.js";

function isMissingStorefrontColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function getFallbackStorefrontAuctionId(
  brandColors: Record<string, unknown> | null
): string | null {
  const value = brandColors?.storefrontAuctionId;
  return typeof value === "string" ? value : null;
}

export async function getTenantStorefrontAuctionId(
  tenantId: string
): Promise<{ storefrontAuctionId: string | null; error: unknown | null }> {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("storefront_auction_id, brand_colors")
    .eq("id", tenantId)
    .single<{
      storefront_auction_id: string | null;
      brand_colors: Record<string, unknown> | null;
    }>();

  if (!error) {
    return {
      storefrontAuctionId:
        data.storefront_auction_id ??
        getFallbackStorefrontAuctionId(data.brand_colors),
      error: null,
    };
  }

  if (!isMissingStorefrontColumn(error)) {
    return { storefrontAuctionId: null, error };
  }

  const fallback = await supabaseAdmin
    .from("tenants")
    .select("brand_colors")
    .eq("id", tenantId)
    .single<{ brand_colors: Record<string, unknown> | null }>();

  if (fallback.error) {
    return { storefrontAuctionId: null, error: fallback.error };
  }

  return {
    storefrontAuctionId: getFallbackStorefrontAuctionId(
      fallback.data.brand_colors
    ),
    error: null,
  };
}

export async function setTenantStorefrontAuctionId(
  tenantId: string,
  auctionId: string
): Promise<{ storefrontAuctionId: string | null; error: unknown | null }> {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .update({ storefront_auction_id: auctionId })
    .eq("id", tenantId)
    .select("storefront_auction_id")
    .single<{ storefront_auction_id: string | null }>();

  if (!error) {
    return { storefrontAuctionId: data.storefront_auction_id, error: null };
  }

  if (!isMissingStorefrontColumn(error)) {
    return { storefrontAuctionId: null, error };
  }

  const existing = await supabaseAdmin
    .from("tenants")
    .select("brand_colors")
    .eq("id", tenantId)
    .single<{ brand_colors: Record<string, unknown> | null }>();

  if (existing.error) {
    return { storefrontAuctionId: null, error: existing.error };
  }

  const nextBrandColors = {
    ...(existing.data.brand_colors ?? {}),
    storefrontAuctionId: auctionId,
  };

  const fallback = await supabaseAdmin
    .from("tenants")
    .update({ brand_colors: nextBrandColors })
    .eq("id", tenantId)
    .select("brand_colors")
    .single<{ brand_colors: Record<string, unknown> | null }>();

  if (fallback.error) {
    return { storefrontAuctionId: null, error: fallback.error };
  }

  return {
    storefrontAuctionId: getFallbackStorefrontAuctionId(
      fallback.data.brand_colors
    ),
    error: null,
  };
}
