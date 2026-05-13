import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSellerTenantRedirectPath } from "@/lib/storefront-data";
import { getTenantBySlug } from "@/lib/tenant";
import { LotDetail } from "@/components/storefront/lot-detail";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
  await connection();

  const { lotId } = await params;
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");

  if (!tenantSlug) {
    notFound();
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  if (!tenant) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const sellerRedirectPath = await getSellerTenantRedirectPath({
      tenantId: tenant.id,
      userId: user.id,
    });
    if (sellerRedirectPath) {
      redirect(sellerRedirectPath);
    }
  }

  return <LotDetail tenant={tenant} lotId={lotId} user={user} />;
}
