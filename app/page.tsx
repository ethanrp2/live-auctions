import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenantBySlug } from "@/lib/tenant";
import { StorefrontHome } from "@/components/storefront/storefront-home";
import { PlatformHome } from "@/components/platform-home";

export default async function Home() {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (tenantSlug) {
    const tenant = await getTenantBySlug(supabase, tenantSlug);
    if (tenant) {
      return <StorefrontHome tenant={tenant} user={user} />;
    }
  }

  return <PlatformHome user={user} />;
}
