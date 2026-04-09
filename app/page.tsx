import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");
  const tenantSlug = headersList.get("x-tenant-slug");
  const tenantName = headersList.get("x-tenant-name");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (tenantSlug) {
    return (
      <div className="relative flex flex-1 items-center justify-center bg-indigo-50 dark:bg-indigo-950">
        {user && (
          <div className="absolute right-4 top-4 flex items-center gap-3">
            <span className="text-sm text-neutral-600">{user.email}</span>
            <LogoutButton />
          </div>
        )}
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
            Tenant Storefront
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">
            {tenantName}
          </h1>
          <p className="mt-4 text-lg text-indigo-600 dark:text-indigo-400">
            Auction house storefront — coming soon
          </p>
          <div className="mt-6 rounded-lg bg-white p-4 text-left text-sm text-zinc-600 shadow dark:bg-zinc-900 dark:text-zinc-400">
            <p><span className="font-medium text-zinc-900 dark:text-zinc-200">Slug:</span> {tenantSlug}</p>
            <p><span className="font-medium text-zinc-900 dark:text-zinc-200">ID:</span> {tenantId}</p>
          </div>
        </div>
      </div>
    );
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
