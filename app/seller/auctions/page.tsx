import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AuctionsListView,
  type AuctionListItem,
  type SellerHouseSummary,
} from "./view";

export const dynamic = "force-dynamic";

interface BackendAuctionRow {
  id: string;
  title: string;
  status: string | null;
  scheduled_date: string | null;
  current_lot_id: string | null;
  basta_sale_id: string | null;
  description: string | null;
  created_at: string;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

function tenantSellerUrl(slug: string, host: string): string {
  const protocol = ROOT_DOMAIN === "localhost" ? "http" : "https";
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
  return `${protocol}://${slug}.${ROOT_DOMAIN}${port}/seller/auctions`;
}

export default async function SellerAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ house?: string | string[] }>;
}) {
  const params = await searchParams;
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");
  const host = headersList.get("host") ?? ROOT_DOMAIN;
  const requestedHouse = Array.isArray(params.house) ? params.house[0] : params.house;

  if (!tenantSlug && requestedHouse) {
    redirect(tenantSellerUrl(requestedHouse, host));
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_seller, display_name, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_seller) {
    redirect("/");
  }

  if (!profile.tenant_id) {
    return (
      <AuctionsListView
        auctions={[]}
        fetchError="This seller account is not assigned to a house."
        sellerName={profile.display_name ?? "Seller"}
        houses={[]}
        selectedHouseSlug={null}
        storefrontAuctionId={null}
        requestHost={host}
      />
    );
  }

  const tenantQuery = supabase
    .from("tenants")
    .select("id, slug, name, description, logo_url, hero_image_url, brand_colors")
    .eq("id", profile.tenant_id);

  const { data: tenant } = await (tenantSlug
    ? tenantQuery.eq("slug", tenantSlug)
    : tenantQuery
  ).maybeSingle<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      logo_url: string | null;
      hero_image_url: string | null;
      brand_colors: Record<string, string> | null;
    }>();

  if (!tenant) {
    const { data: assignedTenant } = await supabase
      .from("tenants")
      .select("slug")
      .eq("id", profile.tenant_id)
      .maybeSingle<{ slug: string }>();
    redirect(assignedTenant?.slug ? tenantSellerUrl(assignedTenant.slug, host) : "/");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  let auctions: AuctionListItem[] = [];
  let fetchError: string | null = null;
  let summaryAuctionCount = 0;
  let summaryActiveAuctionCount = 0;
  let summaryLotCount = 0;
  const { data: storefrontSelection } = await supabase
    .from("tenants")
    .select("storefront_auction_id")
    .eq("id", tenant.id)
    .maybeSingle<{ storefront_auction_id: string | null }>();
  let storefrontAuctionId =
    storefrontSelection?.storefront_auction_id ?? null;

  if (tenantSlug && accessToken) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/seller/auctions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        fetchError = data.error ?? `Failed to load auctions (HTTP ${res.status})`;
      } else {
        const json = (await res.json()) as {
          auctions: BackendAuctionRow[];
          storefrontAuctionId?: string | null;
        };
        const rows = json.auctions ?? [];
        storefrontAuctionId = json.storefrontAuctionId ?? storefrontAuctionId;

        // Fetch lot counts for each auction in parallel.
        const counts = await Promise.all(
          rows.map(async (row) => {
            const { count } = await supabase
              .from("lots")
              .select("id", { count: "exact", head: true })
              .eq("auction_id", row.id)
              .eq("tenant_id", profile.tenant_id);
            return count ?? 0;
          })
        );

        auctions = rows.map((row, idx) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          scheduledDate: row.scheduled_date,
          bastaSaleId: row.basta_sale_id,
          lotCount: counts[idx] ?? 0,
        }));
        summaryAuctionCount = auctions.length;
        summaryActiveAuctionCount = auctions.filter((auction) => {
          const status = (auction.status ?? "draft").toLowerCase();
          return status === "draft" || status === "published" || status === "scheduled" || status === "live";
        }).length;
        summaryLotCount = auctions.reduce((sum, auction) => sum + auction.lotCount, 0);
      }
    } catch (err) {
      fetchError =
        err instanceof Error && err.message !== "fetch failed"
          ? err.message
          : "Seller API unavailable";
    }
  } else if (tenantSlug) {
    fetchError = "Not authenticated";
  } else {
    const [{ count: auctionCount }, { count: activeCount }, { count: lotCount }] =
      await Promise.all([
        supabase
          .from("auctions")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id),
        supabase
          .from("auctions")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .in("status", ["draft", "published", "scheduled", "live"]),
        supabase
          .from("lots")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id),
      ]);
    summaryAuctionCount = auctionCount ?? 0;
    summaryActiveAuctionCount = activeCount ?? 0;
    summaryLotCount = lotCount ?? 0;
  }

  const house: SellerHouseSummary = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    description: tenant.description,
    logoUrl: tenant.logo_url,
    heroImageUrl: tenant.hero_image_url,
    primaryColor: tenant.brand_colors?.primary ?? "#000000",
    auctionCount: summaryAuctionCount,
    activeAuctionCount: summaryActiveAuctionCount,
    lotCount: summaryLotCount,
  };

  return (
    <AuctionsListView
      auctions={auctions}
      fetchError={fetchError}
      sellerName={profile.display_name ?? "Seller"}
      houses={[house]}
      selectedHouseSlug={tenantSlug === tenant.slug ? tenant.slug : null}
      storefrontAuctionId={storefrontAuctionId}
      requestHost={host}
    />
  );
}
