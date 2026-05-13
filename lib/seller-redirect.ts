type SellerProfileRow = {
  is_seller: boolean | null;
  tenant_id: string | null;
};

type AuctionIdRow = {
  id: string;
};

type SellerRedirectClient = {
  from: (table: "profiles" | "auctions") => {
    select: (columns: string) => unknown;
  };
};

type QueryBuilder<T> = {
  eq: (column: string, value: string) => QueryBuilder<T>;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  maybeSingle: () => Promise<{ data: T | null }>;
};

function asQuery<T>(value: unknown): QueryBuilder<T> {
  return value as QueryBuilder<T>;
}

export async function getSellerRedirectPathForUser(params: {
  supabase: SellerRedirectClient;
  userId: string;
  tenantId?: string | null;
}): Promise<string | null> {
  const { data: profile } = await asQuery<SellerProfileRow>(
    params.supabase
      .from("profiles")
      .select("is_seller, tenant_id")
  )
    .eq("id", params.userId)
    .maybeSingle();

  if (!profile?.is_seller || !profile.tenant_id) return null;
  if (params.tenantId && profile.tenant_id !== params.tenantId) return null;

  const { data: liveAuction } = await asQuery<AuctionIdRow>(
    params.supabase
      .from("auctions")
      .select("id")
  )
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "live")
    .order("went_live_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return liveAuction ? `/console/${liveAuction.id}` : "/seller/auctions";
}
