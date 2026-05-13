import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSellerTenantRedirectPath } from "@/lib/storefront-data";
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
      if (user) {
        const sellerRedirectPath = await getSellerTenantRedirectPath({
          tenantId: tenant.id,
          userId: user.id,
        });
        if (sellerRedirectPath) {
          redirect(sellerRedirectPath);
        }
      }
      return <StorefrontHome tenant={tenant} user={user} />;
    }
  }

  return <PlatformHome user={user} />;
}
