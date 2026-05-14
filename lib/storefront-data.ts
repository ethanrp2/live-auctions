import { createClient } from "@/lib/supabase/server";
import { fetchDisplayNames } from "@/lib/profile-display-names";
import { getSellerRedirectPathForUser } from "@/lib/seller-redirect";
import {
  getStorefrontAuctionPhase,
  getStorefrontLotOutcome,
  getWinnerDisplayLabel,
  type StorefrontAuctionPhase,
  type StorefrontLotOutcome,
} from "@/lib/storefront-state";

export interface StorefrontLot {
  id: string;
  title: string;
  images: string[];
  brand: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  starting_bid: number | null;
  sort_order: number | null;
  live_status?: string | null;
  winner_user_id?: string | null;
  winner_display_name?: string | null;
  winning_bid_cents?: number | null;
  sold_at?: string | null;
}

export interface StorefrontAuction {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  status: string | null;
  current_lot_id: string | null;
  went_live_at: string | null;
  ended_at: string | null;
  lots: StorefrontLot[];
}

export interface StorefrontLotDetail extends StorefrontLot {
  description: string | null;
  condition_report: string | null;
  measurements: string | null;
  year: number | null;
  provenance: string | null;
  item_location: string | null;
  shipping_terms: string | null;
  tags: string[];
}

export interface LotRibbonItem {
  id: string;
  title: string;
  thumbnail: string | null;
  sort_order: number | null;
  live_status?: string | null;
  winning_bid_cents?: number | null;
  winner_display_name?: string | null;
}

interface AuctionRow {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  status: string | null;
  current_lot_id: string | null;
  went_live_at: string | null;
  ended_at: string | null;
}

interface LotRow {
  id: string;
  auction_id: string;
  title: string;
  images: string[] | null;
  tags: string[] | null;
  estimate_low: number | null;
  estimate_high: number | null;
  starting_bid: number | null;
  sort_order: number | null;
  description?: string | null;
  condition_report?: string | null;
  measurements?: string | null;
  year?: number | null;
  provenance?: string | null;
  item_location?: string | null;
  shipping_terms?: string | null;
  live_status: string | null;
  winner_user_id: string | null;
  winning_bid_cents: number | null;
  sold_at: string | null;
}

function isMissingStorefrontColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function getFallbackStorefrontAuctionId(
  brandColors: Record<string, unknown> | null
): string | null {
  const value = brandColors?.storefrontAuctionId;
  return typeof value === "string" ? value : null;
}

async function getSelectedStorefrontAuctionId(
  tenantId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("storefront_auction_id, brand_colors")
    .eq("id", tenantId)
    .maybeSingle<{
      storefront_auction_id: string | null;
      brand_colors: Record<string, unknown> | null;
    }>();

  if (!error) {
    return (
      data?.storefront_auction_id ??
      getFallbackStorefrontAuctionId(data?.brand_colors ?? null)
    );
  }

  if (!isMissingStorefrontColumn(error)) {
    return null;
  }

  const fallback = await supabase
    .from("tenants")
    .select("brand_colors")
    .eq("id", tenantId)
    .maybeSingle<{ brand_colors: Record<string, unknown> | null }>();

  if (fallback.error) {
    return null;
  }

  return getFallbackStorefrontAuctionId(fallback.data?.brand_colors ?? null);
}

// All money values in cents (see docs/memory/architecture/money-units.md).
const MOCK_AUCTION: StorefrontAuction = {
  id: "mock-auction",
  title: "February 80s-90s Vintage Tees",
  description:
    "Our team emphasizes sourcing garments that show signs of aging and wear. We like to showcase clothes that others would see as imperfect or, in some cases, unwearable. We take pride in selling garments with these characteristics.",
  scheduled_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  status: "published",
  current_lot_id: null,
  went_live_at: null,
  ended_at: null,
  lots: [
    {
      id: "m1",
      title: "'Leave Me Alone\" T-Shirt",
      images: [
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&h=800&fit=crop",
      ],
      brand: null,
      estimate_low: 6500,
      estimate_high: 6500,
      starting_bid: 1000,
      sort_order: 0,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m2",
      title: "Misfits 'Crimson Ghost Faded Black S...",
      images: [],
      brand: null,
      estimate_low: 6500,
      estimate_high: 6500,
      starting_bid: 1500,
      sort_order: 1,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m3",
      title: "Thrashed Sistine Chapel T-Shirt",
      images: [],
      brand: null,
      estimate_low: 16000,
      estimate_high: 16000,
      starting_bid: 3000,
      sort_order: 2,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m4",
      title: "Led Zepellin Thrashed & Safety Pinne...",
      images: [],
      brand: null,
      estimate_low: 27500,
      estimate_high: 27500,
      starting_bid: 7500,
      sort_order: 3,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m5",
      title: "'Byte Me' T-Shirt",
      images: [],
      brand: null,
      estimate_low: 6000,
      estimate_high: 6000,
      starting_bid: 1000,
      sort_order: 4,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m6",
      title: "1991 New York Post T-Shirt",
      images: [],
      brand: null,
      estimate_low: 6500,
      estimate_high: 6500,
      starting_bid: 1500,
      sort_order: 5,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m7",
      title: "Cross Patch Denim Jacket",
      images: [],
      brand: "CHROME HEARTS",
      estimate_low: null,
      estimate_high: null,
      starting_bid: 8000,
      sort_order: 6,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m8",
      title: "Cross Patch Denim Jacket",
      images: [],
      brand: "CHROME HEARTS",
      estimate_low: null,
      estimate_high: null,
      starting_bid: 2000,
      sort_order: 7,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
    {
      id: "m9",
      title: "Cross Patch Denim Jacket",
      images: [],
      brand: "CHROME HEARTS",
      estimate_low: null,
      estimate_high: null,
      starting_bid: 2500,
      sort_order: 8,
      live_status: "upcoming",
      winner_user_id: null,
      winner_display_name: null,
      winning_bid_cents: null,
      sold_at: null,
    },
  ],
};

const MOCK_LOT_DETAILS: Record<string, Omit<StorefrontLotDetail, keyof StorefrontLot>> = {
  m1: {
    description:
      "A bold statement piece from the early 90s. This \"Leave Me Alone\" t-shirt captures the DIY punk aesthetic of the era with hand-screened graphics on a heavyweight cotton blank. The graphic shows significant age-related cracking and the collar has been hand-repaired with visible stitching — exactly the kind of character we look for.",
    condition_report:
      "Fair to Good. Graphic cracking throughout. Small hole near hem (left side). Collar re-stitched by hand. Consistent fading. No staining.",
    measurements: "Chest: 22\" / Length: 28\" / Sleeve: 8.5\"",
    year: 1992,
    provenance: "Sourced from a private collection in Portland, OR",
    item_location: "Brooklyn, NY",
    shipping_terms: "Ships within 3 business days. Domestic only. Buyer pays shipping.",
    tags: ["VINTAGE", "90S", "TEE", "PUNK"],
  },
  m2: {
    description:
      "Misfits Crimson Ghost tee in a heavily faded black. The iconic Crimson Ghost skull print is intact but shows beautiful age-related wear. A true collector piece for punk and horror memorabilia fans.",
    condition_report:
      "Good. Overall fading consistent with age. Minor pilling. No holes or tears. Print is slightly cracked but fully legible.",
    measurements: "Chest: 21\" / Length: 27.5\" / Sleeve: 8\"",
    year: 1988,
    provenance: "Estate sale, New Jersey",
    item_location: "Brooklyn, NY",
    shipping_terms: "Ships within 3 business days. Domestic only. Buyer pays shipping.",
    tags: ["VINTAGE", "80S", "MISFITS", "PUNK"],
  },
  m3: {
    description:
      "Sistine Chapel souvenir tee that has been thrashed beyond recognition — and that's exactly why we love it. The print is barely visible, the fabric is paper-thin, and it drapes like nothing else. Museum-quality wear.",
    condition_report:
      "Poor (intentionally). Paper-thin fabric. Multiple small holes. Print ~70% faded. Neck stretched. This is the aesthetic.",
    measurements: "Chest: 23\" / Length: 29\" / Sleeve: 9\"",
    year: 1990,
    provenance: "Vintage dealer, Rome, Italy",
    item_location: "Brooklyn, NY",
    shipping_terms: "Ships within 3 business days. International available.",
    tags: ["VINTAGE", "90S", "ART", "THRASHED"],
  },
};

function normalizeAuctionDate(value: string | null, fallback?: string | null): string {
  return value ?? fallback ?? new Date().toISOString();
}

async function loadWinnerDisplayNames(lots: Array<{ winner_user_id: string | null }>) {
  const winnerIds = Array.from(
    new Set(lots.map((lot) => lot.winner_user_id).filter((id): id is string => Boolean(id)))
  );
  return fetchDisplayNames(winnerIds);
}

function mapStorefrontLot(row: LotRow, winnerDisplayNames: Map<string, string | null>): StorefrontLot {
  return {
    id: row.id,
    title: row.title,
    images: row.images ?? [],
    brand: row.tags && row.tags.length > 0 ? row.tags[0] : null,
    estimate_low: row.estimate_low,
    estimate_high: row.estimate_high,
    starting_bid: row.starting_bid,
    sort_order: row.sort_order,
    live_status: row.live_status,
    winner_user_id: row.winner_user_id,
    winner_display_name: row.winner_user_id
      ? winnerDisplayNames.get(row.winner_user_id) ?? null
      : null,
    winning_bid_cents: row.winning_bid_cents,
    sold_at: row.sold_at,
  };
}

function mapStorefrontLotDetail(
  row: LotRow,
  winnerDisplayNames: Map<string, string | null>
): StorefrontLotDetail {
  return {
    ...mapStorefrontLot(row, winnerDisplayNames),
    description: row.description ?? null,
    condition_report: row.condition_report ?? null,
    measurements: row.measurements ?? null,
    year: row.year ?? null,
    provenance: row.provenance ?? null,
    item_location: row.item_location ?? null,
    shipping_terms: row.shipping_terms ?? null,
    tags: row.tags ?? [],
  };
}

export async function getSellerTenantRedirectPath(params: {
  tenantId: string;
  userId: string;
}): Promise<string | null> {
  const supabase = await createClient();
  return getSellerRedirectPathForUser({
    supabase,
    userId: params.userId,
    tenantId: params.tenantId,
  });
}

function getMockLotDetail(lotId: string): StorefrontLotDetail | null {
  const baseLot = MOCK_AUCTION.lots.find((lot) => lot.id === lotId);
  if (!baseLot) return null;

  const details = MOCK_LOT_DETAILS[lotId] ?? {
    description:
      "A unique vintage piece curated by our team. Every garment tells a story through its wear and aging.",
    condition_report: "Good. Minor signs of wear consistent with age.",
    measurements: "Chest: 22\" / Length: 28\" / Sleeve: 8.5\"",
    year: null,
    provenance: null,
    item_location: "Brooklyn, NY",
    shipping_terms: "Ships within 3 business days. Domestic only. Buyer pays shipping.",
    tags: ["VINTAGE"],
  };

  return { ...baseLot, ...details };
}

async function pickStorefrontAuctionRow(tenantId: string): Promise<AuctionRow | null> {
  const supabase = await createClient();

  const selectedAuctionId = await getSelectedStorefrontAuctionId(tenantId);

  if (selectedAuctionId) {
    const { data: selectedAuction } = await supabase
      .from("auctions")
      .select("id, title, description, scheduled_date, status, current_lot_id, went_live_at, ended_at")
      .eq("tenant_id", tenantId)
      .eq("id", selectedAuctionId)
      .maybeSingle<AuctionRow>();

    if (selectedAuction) return selectedAuction;
  }

  const { data: liveAuction } = await supabase
    .from("auctions")
    .select("id, title, description, scheduled_date, status, current_lot_id, went_live_at, ended_at")
    .eq("tenant_id", tenantId)
    .eq("status", "live")
    .order("went_live_at", { ascending: false })
    .limit(1)
    .maybeSingle<AuctionRow>();

  if (liveAuction) return liveAuction;

  const { data: upcomingAuction } = await supabase
    .from("auctions")
    .select("id, title, description, scheduled_date, status, current_lot_id, went_live_at, ended_at")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle<AuctionRow>();

  if (upcomingAuction) return upcomingAuction;

  const { data: endedAuction } = await supabase
    .from("auctions")
    .select("id, title, description, scheduled_date, status, current_lot_id, went_live_at, ended_at")
    .eq("tenant_id", tenantId)
    .in("status", ["ended", "closed"])
    .order("ended_at", { ascending: false })
    .order("scheduled_date", { ascending: false })
    .limit(1)
    .maybeSingle<AuctionRow>();

  return endedAuction ?? null;
}

export async function getStorefrontLotDetail(
  tenantId: string,
  lotId: string
): Promise<{
  lot: StorefrontLotDetail;
  auction: StorefrontAuction;
  ribbonLots: LotRibbonItem[];
  isMock: boolean;
} | null> {
  const supabase = await createClient();

  const { data: lotRow } = await supabase
    .from("lots")
    .select(
      "id, auction_id, title, images, tags, estimate_low, estimate_high, starting_bid, sort_order, description, condition_report, measurements, year, provenance, item_location, shipping_terms, live_status, winner_user_id, winning_bid_cents, sold_at"
    )
    .eq("id", lotId)
    .maybeSingle<LotRow>();

  if (lotRow) {
    const { data: auctionRow } = await supabase
      .from("auctions")
      .select(
        "id, title, description, scheduled_date, status, current_lot_id, tenant_id, went_live_at, ended_at"
      )
      .eq("id", lotRow.auction_id)
      .single<(AuctionRow & { tenant_id: string }) | null>();

    if (!auctionRow || auctionRow.tenant_id !== tenantId) return null;

    const { data: siblingRows } = await supabase
      .from("lots")
      .select(
        "id, auction_id, title, images, tags, estimate_low, estimate_high, starting_bid, sort_order, live_status, winner_user_id, winning_bid_cents, sold_at"
      )
      .eq("auction_id", auctionRow.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const allLots = [lotRow, ...((siblingRows ?? []) as LotRow[]).filter((row) => row.id !== lotRow.id)];
    const winnerDisplayNames = await loadWinnerDisplayNames(allLots);

    const lot = mapStorefrontLotDetail(lotRow, winnerDisplayNames);
    const ribbonLots: LotRibbonItem[] = ((siblingRows ?? []) as LotRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      thumbnail: row.images && row.images.length > 0 ? row.images[0] : null,
      sort_order: row.sort_order,
      live_status: row.live_status,
      winning_bid_cents: row.winning_bid_cents,
      winner_display_name: row.winner_user_id
        ? winnerDisplayNames.get(row.winner_user_id) ?? null
        : null,
    }));

    return {
      lot,
      auction: {
        id: auctionRow.id,
        title: auctionRow.title,
        description: auctionRow.description,
        scheduled_date: normalizeAuctionDate(auctionRow.scheduled_date, auctionRow.ended_at),
        status: auctionRow.status,
        current_lot_id: auctionRow.current_lot_id,
        went_live_at: auctionRow.went_live_at,
        ended_at: auctionRow.ended_at,
        lots: [],
      },
      ribbonLots,
      isMock: false,
    };
  }

  const mockLot = getMockLotDetail(lotId);
  if (!mockLot) return null;

  const ribbonLots: LotRibbonItem[] = MOCK_AUCTION.lots.map((lot) => ({
    id: lot.id,
    title: lot.title,
    thumbnail: lot.images.length > 0 ? lot.images[0] : null,
    sort_order: lot.sort_order,
    live_status: lot.live_status,
    winning_bid_cents: lot.winning_bid_cents,
    winner_display_name: lot.winner_display_name,
  }));

  return {
    lot: mockLot,
    auction: MOCK_AUCTION,
    ribbonLots,
    isMock: true,
  };
}

export async function getStorefrontAuction(
  tenantId: string
): Promise<{ auction: StorefrontAuction; isMock: boolean }> {
  const supabase = await createClient();
  const auctionRow = await pickStorefrontAuctionRow(tenantId);

  if (!auctionRow) {
    return { auction: MOCK_AUCTION, isMock: true };
  }

  const { data: lotRows } = await supabase
    .from("lots")
    .select(
      "id, auction_id, title, images, tags, estimate_low, estimate_high, starting_bid, sort_order, live_status, winner_user_id, winning_bid_cents, sold_at"
    )
    .eq("auction_id", auctionRow.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const winnerDisplayNames = await loadWinnerDisplayNames((lotRows ?? []) as LotRow[]);
  const lots = ((lotRows ?? []) as LotRow[]).map((row) =>
    mapStorefrontLot(row, winnerDisplayNames)
  );

  return {
    auction: {
      id: auctionRow.id,
      title: auctionRow.title,
      description: auctionRow.description,
      scheduled_date: normalizeAuctionDate(auctionRow.scheduled_date, auctionRow.ended_at),
      status: auctionRow.status,
      current_lot_id: auctionRow.current_lot_id,
      went_live_at: auctionRow.went_live_at,
      ended_at: auctionRow.ended_at,
      lots,
    },
    isMock: false,
  };
}
