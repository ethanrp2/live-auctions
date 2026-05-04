import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantBySlug } from "@/lib/tenant";
import { getConsoleAuctionForTenant } from "@/lib/live-auction-data";
import {
  ConsoleMobileBlock,
  ConsoleView,
} from "@/components/console/console-view";

export default async function SellerConsolePage() {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");
  if (!tenantSlug) notFound();

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);
  if (!tenant) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/seller/console")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_seller, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.is_seller || profile.tenant_id !== tenant.id) {
    redirect("/seller/onboarding");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent("/seller/console")}`);
  }

  const initial = await getConsoleAuctionForTenant(tenant.id);
  if (!initial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em] text-black">
            No auction yet
          </h1>
          <p className="mt-2 text-sm text-[#5e5e5e]">
            Create an auction and add lots before running the console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConsoleView
        tenant={tenant}
        user={user}
        initial={initial}
        accessToken={session.access_token}
      />
      <ConsoleMobileBlock />
    </>
  );
}
