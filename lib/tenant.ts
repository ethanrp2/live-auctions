import { SupabaseClient } from "@supabase/supabase-js";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  brand_colors: Record<string, string>;
  font_display: string;
  font_mono: string;
}

export async function getTenantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select(
      "id, slug, name, description, logo_url, hero_image_url, brand_colors, font_display, font_mono"
    )
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Tenant;
}
