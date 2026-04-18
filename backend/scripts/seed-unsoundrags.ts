/**
 * Seed script for the unsoundrags storefront.
 *
 * Downloads Figma assets → uploads to Supabase Storage → creates a Basta sale +
 * items → writes auction + lots + tenant config into Postgres.
 *
 * Run:
 *   cd backend && pnpm tsx scripts/seed-unsoundrags.ts
 *
 * Idempotent: re-running upserts tenant config, overwrites storage, skips
 * auction + basta creation if an auction with the same title already exists for
 * this tenant.
 */

import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabase.js";
import {
  createSale,
  createItemForSale,
  publishSale,
} from "../src/lib/basta.js";

const TENANT_SLUG = "unsoundrags";
const BUCKET = "storefront-assets";
const AUCTION_TITLE = "February 80s-90s Vintage Tees";
const AUCTION_DESCRIPTION =
  "Our team emphasizes sourcing garments that show signs of aging and wear. We like to showcase clothes that others would see as imperfect or, in some cases, unwearable. We take pride in selling garments with these characteristics.";
// One year out so the "upcoming" query keeps returning it.
const SCHEDULED_DATE = new Date(
  Date.UTC(new Date().getUTCFullYear() + 1, 1, 27, 14, 15, 0)
).toISOString();

interface AssetSpec {
  key: string;
  url: string;
  ext: "jpg" | "png";
}

// Figma MCP asset URLs — these expire after 7 days. Refresh by re-running
// `get_design_context` on node 3272:533 if the downloads start 404ing.
const HERO_ASSET: AssetSpec = {
  key: "hero",
  url: "https://www.figma.com/api/mcp/asset/130f9d3b-53cf-457a-8975-37cc12234a62",
  ext: "jpg",
};

const LOGO_ASSET: AssetSpec = {
  key: "logo",
  url: "https://www.figma.com/api/mcp/asset/8764fe21-0b4b-45f9-89ae-6ad2cefdafd9",
  ext: "png",
};

interface LotSeed {
  index: number;
  title: string;
  description: string;
  brand: string | null;
  starting_bid: number;
  estimate_low: number | null;
  estimate_high: number | null;
  imageUrl: string;
}

const LOTS: LotSeed[] = [
  {
    index: 1,
    title: "\u2018Leave Me Alone\u201D T-Shirt",
    description: "Vintage print tee, natural fade, collar wear consistent with age.",
    brand: null,
    starting_bid: 10,
    estimate_low: 65,
    estimate_high: 65,
    imageUrl: "https://www.figma.com/api/mcp/asset/0c88743f-f238-45f6-b8cb-b34a5884cb98",
  },
  {
    index: 2,
    title: "Misfits \u2018Crimson Ghost Faded Black S...",
    description: "Misfits Crimson Ghost band tee, faded black sleeveless cut.",
    brand: null,
    starting_bid: 15,
    estimate_low: 65,
    estimate_high: 65,
    imageUrl: "https://www.figma.com/api/mcp/asset/1de705de-260d-4602-8f19-7c15932a0264",
  },
  {
    index: 3,
    title: "Thrashed Sistine Chapel T-Shirt",
    description: "Heavily thrashed Sistine Chapel art print tee.",
    brand: null,
    starting_bid: 30,
    estimate_low: 160,
    estimate_high: 160,
    imageUrl: "https://www.figma.com/api/mcp/asset/b6e13cc6-7f14-4ad4-a5c0-2f310ac95a80",
  },
  {
    index: 4,
    title: "Led Zepellin Thrashed & Safety Pinne... ",
    description: "Led Zeppelin tee, thrashed and safety-pinned repair detail.",
    brand: null,
    starting_bid: 75,
    estimate_low: 275,
    estimate_high: 275,
    imageUrl: "https://www.figma.com/api/mcp/asset/4ab71b05-500e-4519-9181-3f6aef0996ca",
  },
  {
    index: 5,
    title: "\u2018Byte Me\u2019 T-Shirt",
    description: "\u201CByte Me\u201D slogan tee, washed black.",
    brand: null,
    starting_bid: 10,
    estimate_low: 60,
    estimate_high: 60,
    imageUrl: "https://www.figma.com/api/mcp/asset/089fddcb-d78b-4e1c-836c-b7416a999af7",
  },
  {
    index: 6,
    title: "1991 New York Post T-Shirt",
    description: "1991 New York Post commemorative tee.",
    brand: null,
    starting_bid: 15,
    estimate_low: 65,
    estimate_high: 65,
    imageUrl: "https://www.figma.com/api/mcp/asset/0a93ac4a-0d83-41b8-b104-7ccee8afb1c0",
  },
  {
    index: 7,
    title: "Cross Patch Denim Jacket",
    description: "Chrome Hearts cross patch denim jacket.",
    brand: "CHROME HEARTS",
    starting_bid: 80,
    estimate_low: null,
    estimate_high: null,
    imageUrl: "https://www.figma.com/api/mcp/asset/5372d174-221a-4d5e-842f-7912bbe0ff1f",
  },
  {
    index: 8,
    title: "Cross Patch Denim Jacket",
    description: "Chrome Hearts cross patch denim jacket.",
    brand: "CHROME HEARTS",
    starting_bid: 20,
    estimate_low: null,
    estimate_high: null,
    imageUrl: "https://www.figma.com/api/mcp/asset/38a42fb1-6680-4fa0-b923-680a0089bd90",
  },
  {
    index: 9,
    title: "Cross Patch Denim Jacket",
    description: "Chrome Hearts cross patch denim jacket.",
    brand: "CHROME HEARTS",
    starting_bid: 25,
    estimate_low: null,
    estimate_high: null,
    imageUrl: "https://www.figma.com/api/mcp/asset/36433d9a-7a77-4193-98d6-ec7b634cb37f",
  },
];

// Basta money values are in cents. Each (highRange - lowRange) must be evenly
// divisible by step.
const BID_INCREMENT_TABLE = [
  { lowRange: 0, highRange: 10_000, step: 500 },        // $0–$100, $5 step
  { lowRange: 10_000, highRange: 50_000, step: 1_000 }, // $100–$500, $10 step
  { lowRange: 50_000, highRange: 10_000_000, step: 2_500 }, // $500–$100k, $25 step
];

const toCents = (dollars: number) => Math.round(dollars * 100);

async function ensureBucket(): Promise<void> {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;
  if (buckets?.some((b) => b.name === BUCKET)) return;

  console.log(`→ creating public bucket "${BUCKET}"`);
  const { error: createError } = await supabaseAdmin.storage.createBucket(
    BUCKET,
    {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    }
  );
  if (createError) throw createError;
}

async function uploadAsset(
  sourceUrl: string,
  destPath: string,
  contentType: string
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(destPath, buf, {
      contentType,
      upsert: true,
    });
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(destPath);
  return data.publicUrl;
}

function contentTypeFor(ext: "jpg" | "png"): string {
  return ext === "png" ? "image/png" : "image/jpeg";
}

async function main() {
  console.log("=== Seeding unsoundrags storefront ===");

  // 1. Tenant lookup
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, slug")
    .eq("slug", TENANT_SLUG)
    .single();
  if (tenantError || !tenant) {
    throw new Error(
      `Tenant "${TENANT_SLUG}" not found. Create the row first: INSERT INTO tenants (slug, name) VALUES ('${TENANT_SLUG}', 'Unsound Rags');`
    );
  }
  console.log(`✓ tenant ${tenant.slug} (${tenant.id})`);

  // 2. Storage bucket
  await ensureBucket();
  console.log(`✓ bucket "${BUCKET}" ready`);

  // 3. Upload hero + logo
  console.log("→ uploading hero + logo");
  const heroUrl = await uploadAsset(
    HERO_ASSET.url,
    `${TENANT_SLUG}/hero.${HERO_ASSET.ext}`,
    contentTypeFor(HERO_ASSET.ext)
  );
  const logoUrl = await uploadAsset(
    LOGO_ASSET.url,
    `${TENANT_SLUG}/logo.${LOGO_ASSET.ext}`,
    contentTypeFor(LOGO_ASSET.ext)
  );
  console.log(`  hero: ${heroUrl}`);
  console.log(`  logo: ${logoUrl}`);

  // 4. Upload lot images in parallel
  console.log("→ uploading lot images");
  const lotImageUrls = await Promise.all(
    LOTS.map((lot) =>
      uploadAsset(
        lot.imageUrl,
        `${TENANT_SLUG}/lots/${String(lot.index).padStart(2, "0")}.jpg`,
        "image/jpeg"
      )
    )
  );
  lotImageUrls.forEach((url, i) =>
    console.log(`  lot ${String(i + 1).padStart(2, "0")}: ${url}`)
  );

  // 5. Update tenant row (logo, hero, colors, fonts)
  const { error: tenantUpdateError } = await supabaseAdmin
    .from("tenants")
    .update({
      logo_url: logoUrl,
      hero_image_url: heroUrl,
      brand_colors: { primary: "#000000" },
      font_display: "inter",
      font_mono: "jetbrains_mono",
      description:
        "Curated vintage garments — t-shirts, denim, and one-of-a-kind drops from the 80s and 90s.",
    })
    .eq("id", tenant.id);
  if (tenantUpdateError) throw tenantUpdateError;
  console.log("✓ tenant row updated (logo, hero, brand, fonts)");

  // 6. Check for existing auction
  const { data: existingAuction } = await supabaseAdmin
    .from("auctions")
    .select("id, basta_sale_id")
    .eq("tenant_id", tenant.id)
    .eq("title", AUCTION_TITLE)
    .maybeSingle();

  let auctionId: string;
  let bastaSaleId: string | null = existingAuction?.basta_sale_id ?? null;

  if (existingAuction) {
    console.log(
      `✓ auction already exists (id=${existingAuction.id}), skipping Basta creation`
    );
    auctionId = existingAuction.id;
  } else {
    // 7. Create Basta sale
    console.log("→ creating Basta sale");
    const sale = await createSale({
      title: AUCTION_TITLE,
      description: AUCTION_DESCRIPTION,
      closingMethod: "OVERLAPPING",
      closingTimeCountdown: 30_000,
      bidIncrementTable: BID_INCREMENT_TABLE,
    });
    bastaSaleId = sale.id;
    console.log(`  basta sale id: ${bastaSaleId}`);

    // 8. Insert auction row
    const { data: inserted, error: auctionError } = await supabaseAdmin
      .from("auctions")
      .insert({
        tenant_id: tenant.id,
        basta_sale_id: bastaSaleId,
        title: AUCTION_TITLE,
        description: AUCTION_DESCRIPTION,
        status: "published",
        scheduled_date: SCHEDULED_DATE,
      })
      .select("id")
      .single();
    if (auctionError || !inserted) throw auctionError;
    auctionId = inserted.id;
    console.log(`✓ auction inserted (id=${auctionId})`);
  }

  // 9. Delete existing lots + re-insert (easiest idempotency)
  console.log("→ refreshing lots");
  const { error: deleteError } = await supabaseAdmin
    .from("lots")
    .delete()
    .eq("auction_id", auctionId);
  if (deleteError) throw deleteError;

  const lotsPayload = LOTS.map((lot, i) => ({
    tenant_id: tenant.id,
    auction_id: auctionId,
    basta_item_id: null as string | null,
    title: lot.title,
    description: lot.description,
    images: [lotImageUrls[i]],
    estimate_low: lot.estimate_low,
    estimate_high: lot.estimate_high,
    starting_bid: lot.starting_bid,
    reserve: 0,
    tags: lot.brand ? [lot.brand] : [],
    sort_order: i,
    status: "published",
  }));

  // 10. Create Basta items for each lot (only if we have a sale id)
  if (bastaSaleId && !existingAuction) {
    console.log("→ creating Basta items");
    const scheduled = new Date(SCHEDULED_DATE).getTime();
    for (let i = 0; i < LOTS.length; i++) {
      const lot = LOTS[i];
      const openDate = new Date(scheduled).toISOString();
      const closingDate = new Date(scheduled + (i + 1) * 10 * 60_000).toISOString();
      const item = await createItemForSale({
        saleId: bastaSaleId,
        title: lot.title,
        description: lot.description,
        startingBid: toCents(lot.starting_bid),
        reserve: 0,
        openDate,
        closingDate,
      });
      lotsPayload[i].basta_item_id = item.id;
      console.log(`  lot ${lot.index}: basta item ${item.id}`);
    }

    console.log("→ publishing Basta sale");
    await publishSale(bastaSaleId);
    console.log("✓ basta sale published");
  }

  const { error: lotsInsertError } = await supabaseAdmin
    .from("lots")
    .insert(lotsPayload);
  if (lotsInsertError) throw lotsInsertError;
  console.log(`✓ inserted ${lotsPayload.length} lots`);

  console.log("\n=== Done ===");
  console.log(`Visit http://${TENANT_SLUG}.localhost:3000 to view the storefront.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
