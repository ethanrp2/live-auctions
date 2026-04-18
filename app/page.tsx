import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { getTenantBySlug } from "@/lib/tenant";
import { StorefrontHome } from "@/components/storefront/storefront-home";

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

  return (
    <div className="relative flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      {user && (
        <div className="absolute right-4 top-4 flex items-center gap-3">
          <span className="text-sm text-neutral-600">{user.email}</span>
          <LogoutButton />
        </div>
      )}
      <div className="text-center">
        <div className="mb-4 inline-block rounded-full bg-zinc-200 px-4 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Platform Home
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
          Live Auctions
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Real-time auctions for independent auction houses
        </p>
      </div>
    </div>
  );
}
