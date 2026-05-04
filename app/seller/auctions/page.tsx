import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuctionsListView, type AuctionListItem } from "./view";

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

export default async function SellerAuctionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_seller, display_name, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_seller) {
    redirect("/");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  let auctions: AuctionListItem[] = [];
  let fetchError: string | null = null;

  if (accessToken) {
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
        const json = (await res.json()) as { auctions: BackendAuctionRow[] };
        const rows = json.auctions ?? [];

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
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Failed to load auctions";
    }
  } else {
    fetchError = "Not authenticated";
  }

  return (
    <AuctionsListView
      auctions={auctions}
      fetchError={fetchError}
      sellerName={profile.display_name ?? "Seller"}
    />
  );
}
