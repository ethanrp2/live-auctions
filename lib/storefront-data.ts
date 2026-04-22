import { createClient } from "@/lib/supabase/server";

export interface StorefrontLot {
  id: string;
  title: string;
  images: string[];
  brand: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  starting_bid: number | null;
  sort_order: number | null;
}

export interface StorefrontAuction {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
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
}

// All money values in cents (see docs/memory/architecture/money-units.md).
const MOCK_AUCTION: StorefrontAuction = {
  id: "mock-auction",
  title: "February 80s-90s Vintage Tees",
  description:
    "Our team emphasizes sourcing garments that show signs of aging and wear. We like to showcase clothes that others would see as imperfect or, in some cases, unwearable. We take pride in selling garments with these characteristics.",
  scheduled_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  lots: [
    { id: "m1", title: "'Leave Me Alone\" T-Shirt", images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=800&fit=crop",
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&h=800&fit=crop",
    ], brand: null, estimate_low: 6500, estimate_high: 6500, starting_bid: 1000, sort_order: 0 },
    { id: "m2", title: "Misfits 'Crimson Ghost Faded Black S...", images: [], brand: null, estimate_low: 6500, estimate_high: 6500, starting_bid: 1500, sort_order: 1 },
    { id: "m3", title: "Thrashed Sistine Chapel T-Shirt", images: [], brand: null, estimate_low: 16000, estimate_high: 16000, starting_bid: 3000, sort_order: 2 },
    { id: "m4", title: "Led Zepellin Thrashed & Safety Pinne...", images: [], brand: null, estimate_low: 27500, estimate_high: 27500, starting_bid: 7500, sort_order: 3 },
    { id: "m5", title: "'Byte Me' T-Shirt", images: [], brand: null, estimate_low: 6000, estimate_high: 6000, starting_bid: 1000, sort_order: 4 },
    { id: "m6", title: "1991 New York Post T-Shirt", images: [], brand: null, estimate_low: 6500, estimate_high: 6500, starting_bid: 1500, sort_order: 5 },
    { id: "m7", title: "Cross Patch Denim Jacket", images: [], brand: "CHROME HEARTS", estimate_low: null, estimate_high: null, starting_bid: 8000, sort_order: 6 },
    { id: "m8", title: "Cross Patch Denim Jacket", images: [], brand: "CHROME HEARTS", estimate_low: null, estimate_high: null, starting_bid: 2000, sort_order: 7 },
    { id: "m9", title: "Cross Patch Denim Jacket", images: [], brand: "CHROME HEARTS", estimate_low: null, estimate_high: null, starting_bid: 2500, sort_order: 8 },
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

function getMockLotDetail(lotId: string): StorefrontLotDetail | null {
  const baseLot = MOCK_AUCTION.lots.find((l) => l.id === lotId);
  if (!baseLot) return null;
  const details = MOCK_LOT_DETAILS[lotId] ?? {
    description: "A unique vintage piece curated by our team. Every garment tells a story through its wear and aging.",
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

  // Try to fetch the real lot
  const { data: lotRow } = await supabase
    .from("lots")
    .select(
      "id, auction_id, title, images, tags, estimate_low, estimate_high, starting_bid, sort_order, description, condition_report, measurements, year, provenance, item_location, shipping_terms"
    )
    .eq("id", lotId)
    .maybeSingle();

  if (lotRow) {
    // Fetch the parent auction
    const { data: auctionRow } = await supabase
      .from("auctions")
      .select("id, title, description, scheduled_date, tenant_id")
      .eq("id", lotRow.auction_id)
      .single();

    if (!auctionRow || auctionRow.tenant_id !== tenantId) return null;

    // Fetch sibling lots for ribbon
    const { data: siblingRows } = await supabase
      .from("lots")
      .select("id, title, images, sort_order")
      .eq("auction_id", auctionRow.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const lot: StorefrontLotDetail = {
      id: lotRow.id,
      title: lotRow.title,
      images: lotRow.images ?? [],
      brand: lotRow.tags && lotRow.tags.length > 0 ? lotRow.tags[0] : null,
      estimate_low: lotRow.estimate_low,
      estimate_high: lotRow.estimate_high,
      starting_bid: lotRow.starting_bid,
      sort_order: lotRow.sort_order,
      description: lotRow.description,
      condition_report: lotRow.condition_report,
      measurements: lotRow.measurements,
      year: lotRow.year,
      provenance: lotRow.provenance,
      item_location: lotRow.item_location,
      shipping_terms: lotRow.shipping_terms,
      tags: lotRow.tags ?? [],
    };

    const ribbonLots: LotRibbonItem[] = (siblingRows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      thumbnail: r.images && r.images.length > 0 ? r.images[0] : null,
      sort_order: r.sort_order,
    }));

    return {
      lot,
      auction: {
        id: auctionRow.id,
        title: auctionRow.title,
        description: auctionRow.description,
        scheduled_date: auctionRow.scheduled_date,
        lots: [],
      },
      ribbonLots,
      isMock: false,
    };
  }

  // Mock fallback
  const mockLot = getMockLotDetail(lotId);
  if (!mockLot) return null;

  const ribbonLots: LotRibbonItem[] = MOCK_AUCTION.lots.map((l) => ({
    id: l.id,
    title: l.title,
    thumbnail: l.images.length > 0 ? l.images[0] : null,
    sort_order: l.sort_order,
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

  // Show the most relevant auction: a live one first, else the next published upcoming one.
  // Mock fallback kicks in only if neither exists.
  const { data: auctionRow } = await supabase
    .from("auctions")
    .select("id, title, description, scheduled_date, status")
    .eq("tenant_id", tenantId)
    .in("status", ["live", "published"])
    .order("status", { ascending: true }) // 'live' sorts before 'published' alphabetically
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!auctionRow) {
    return { auction: MOCK_AUCTION, isMock: true };
  }

  const { data: lotRows } = await supabase
    .from("lots")
    .select("id, title, images, tags, estimate_low, estimate_high, starting_bid, sort_order")
    .eq("auction_id", auctionRow.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const lots: StorefrontLot[] = (lotRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    images: row.images ?? [],
    brand: row.tags && row.tags.length > 0 ? row.tags[0] : null,
    estimate_low: row.estimate_low,
    estimate_high: row.estimate_high,
    starting_bid: row.starting_bid,
    sort_order: row.sort_order,
  }));

  return {
    auction: {
      id: auctionRow.id,
      title: auctionRow.title,
      description: auctionRow.description,
      scheduled_date: auctionRow.scheduled_date,
      lots,
    },
    isMock: false,
  };
}
