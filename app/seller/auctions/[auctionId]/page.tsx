import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuctionEditorView, type EditorAuction, type EditorLot } from "./view";

interface BackendAuctionRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  scheduled_date: string | null;
  basta_sale_id: string | null;
  current_lot_id: string | null;
}

interface BackendLotRow {
  id: string;
  title: string;
  description: string | null;
  images: string[] | null;
  condition_report: string | null;
  measurements: string | null;
  year: number | null;
  provenance: string | null;
  item_location: string | null;
  shipping_terms: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  starting_bid: number | null;
  reserve: number | null;
  tags: string[] | null;
  sort_order: number | null;
  status: string | null;
  basta_item_id: string | null;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function mapLot(row: BackendLotRow): EditorLot {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: row.images ?? [],
    conditionReport: row.condition_report,
    measurements: row.measurements,
    year: row.year,
    provenance: row.provenance,
    itemLocation: row.item_location,
    shippingTerms: row.shipping_terms,
    estimateLow: row.estimate_low,
    estimateHigh: row.estimate_high,
    startingBid: row.starting_bid,
    reserve: row.reserve,
    tags: row.tags ?? [],
    sortOrder: row.sort_order,
    status: row.status,
    bastaItemId: row.basta_item_id,
  };
}

export default async function SellerAuctionEditorPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
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

  if (!accessToken) {
    redirect("/login");
  }

  const res = await fetch(`${BACKEND_URL}/api/seller/auctions/${auctionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 404) {
    redirect("/seller/auctions");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white px-4"
        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        <div className="max-w-md rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 p-6 text-center">
          <p className="text-[12px] uppercase tracking-widest text-[#ff0004]">
            FAILED TO LOAD AUCTION
          </p>
          <p className="mt-2 text-[12px] text-black/60">
            {data.error ?? `HTTP ${res.status}`}
          </p>
        </div>
      </div>
    );
  }

  const json = (await res.json()) as {
    auction: BackendAuctionRow;
    lots: BackendLotRow[];
  };

  const auction: EditorAuction = {
    id: json.auction.id,
    title: json.auction.title,
    description: json.auction.description,
    status: json.auction.status,
    scheduledDate: json.auction.scheduled_date,
    bastaSaleId: json.auction.basta_sale_id,
    currentLotId: json.auction.current_lot_id,
  };

  const lots: EditorLot[] = (json.lots ?? []).map(mapLot);

  return (
    <AuctionEditorView
      auction={auction}
      initialLots={lots}
      sellerName={profile.display_name ?? "Seller"}
    />
  );
}
