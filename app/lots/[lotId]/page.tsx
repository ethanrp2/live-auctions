import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenantBySlug } from "@/lib/tenant";
import { LotDetail } from "@/components/storefront/lot-detail";
import { LiveAuctionView } from "@/components/live/live-auction-view";
import { getLiveAuctionForTenant } from "@/lib/live-auction-data";
import { notFound } from "next/navigation";

export default async function LotPage({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
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

  const live = await getLiveAuctionForTenant(tenant.id);
  if (live) {
    return (
      <LiveAuctionView
        tenant={tenant}
        user={user}
        initial={live}
        initialLotId={lotId}
      />
    );
  }

  return <LotDetail tenant={tenant} lotId={lotId} user={user} />;
}
