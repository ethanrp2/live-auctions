/**
 * Seed script for the basa storefront.
 *
 * Downloads Figma assets -> uploads to Supabase Storage -> creates tenant +
 * auction + lots in Postgres. Matches the BASA Figma designs exactly.
 *
 * Run:
 *   cd backend && pnpm tsx scripts/seed-basa.ts
 *
 * Idempotent: re-running upserts tenant config, overwrites storage, skips
 * auction creation if one with the same title already exists.
 */

import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabase.js";

const TENANT_SLUG = "basa";
const TENANT_NAME = "BASA";
const BUCKET = "storefront-assets";
const AUCTION_TITLE = "Vintage Furniture Archive";
const AUCTION_DESCRIPTION =
  "BASA is a Los Angeles based furniture company that specializes in offering a curated selection of vintage furniture and hi-fi.";
const SCHEDULED_DATE = new Date(
  Date.UTC(new Date().getUTCFullYear() + 1, 2, 4, 13, 0, 0)
).toISOString();

// --- Figma MCP asset URLs (expire after 7 days) ---

const HERO_ASSET = {
  url: "https://www.figma.com/api/mcp/asset/40c35fd9-a0b5-4321-8ed1-2211496ebfe8",
  ext: "jpg" as const,
};

// Logo is a vector SVG in Figma — MCP exports it as a tiny raster that looks
// broken when upscaled. Set logo_url to null so the template renders "BASA"
// as crisp text in the mono font instead.
const LOGO_ASSET = null;

interface LotSeed {
  index: number;
  title: string;
  description: string;
  condition_report: string;
  measurements: string | null;
  year: number | null;
  provenance: string | null;
  item_location: string;
  shipping_terms: string;
  brand: string | null;
  starting_bid: number;
  estimate_low: number | null;
  estimate_high: number | null;
  tags: string[];
  imageUrl: string;
}

const LOTS: LotSeed[] = [
  {
    index: 1,
    title: "Ligne Roset Togo Three Seater in Orange",
    description:
      "Iconic Ligne Roset Togo three-seater sofa in original burnt orange corduroy upholstery. Designed by Michel Ducaroy in 1973, this piece features the signature all-foam construction with quilted ergonomic lines. A cornerstone of 1970s French design.",
    condition_report:
      "Good. Original upholstery with light wear consistent with age. Minor fading on arm rests. Foam is intact and supportive. No structural issues.",
    measurements: 'W: 68" / D: 40" / H: 28"',
    year: 1973,
    provenance: "Private collection, Paris, France",
    item_location: "Los Angeles, CA",
    shipping_terms: "Local pickup or buyer arranges freight. White-glove delivery available.",
    brand: null,
    starting_bid: 15,
    estimate_low: 2400,
    estimate_high: 2400,
    tags: ["FURNITURE", "VINTAGE", "FRENCH DESIGN"],
    imageUrl: "https://www.figma.com/api/mcp/asset/b25d21b9-ae24-4abc-9eaa-89bd72998daa",
  },
  {
    index: 2,
    title: "Ceramic Panther and Glass Coffee Table",
    description:
      "Striking ceramic panther coffee table with beveled glass top. The hand-painted black ceramic panther figure supports a large oval glass surface. A bold conversation piece from the 1970s Italian design scene.",
    condition_report:
      "Good. Ceramic figure intact with minor glaze wear. Glass top has no chips or cracks. Some light surface scratches on glass.",
    measurements: 'W: 48" / D: 24" / H: 18"',
    year: 1975,
    provenance: "Estate sale, Milan, Italy",
    item_location: "Los Angeles, CA",
    shipping_terms: "Local pickup only. Fragile — not available for shipping.",
    brand: null,
    starting_bid: 15,
    estimate_low: 3000,
    estimate_high: 3000,
    tags: ["FURNITURE", "VINTAGE", "ITALIAN"],
    imageUrl: "https://www.figma.com/api/mcp/asset/b94bc316-d001-4f41-98b5-21b6b827b2a3",
  },
  {
    index: 3,
    title: 'Gufram Pratone "Grass" Lounge Chair',
    description:
      'The iconic Pratone ("Big Meadow") lounge chair by Gufram, designed by Ceretti, Derossi, and Rosso in 1971. Polyurethane foam construction shaped like oversized blades of grass in vivid green. A masterpiece of radical Italian design.',
    condition_report:
      "Very Good. Original green polyurethane in excellent condition. No tears, cracks, or discoloration. Minor dust accumulation in crevices.",
    measurements: 'W: 55" / D: 55" / H: 38"',
    year: 1971,
    provenance: "Gallery, Turin, Italy",
    item_location: "Los Angeles, CA",
    shipping_terms: "Buyer arranges freight. Oversized — special handling required.",
    brand: null,
    starting_bid: 15,
    estimate_low: 11500,
    estimate_high: 11500,
    tags: ["FURNITURE", "RADICAL DESIGN", "ITALIAN"],
    imageUrl: "https://www.figma.com/api/mcp/asset/89b13e42-513e-4623-80c2-2b99bfc47d26",
  },
  {
    index: 4,
    title: "Bouloum Lounge Chair by Olivier Mourgue",
    description:
      "Bouloum anthropomorphic lounge chair designed by Olivier Mourgue in 1968. Tubular steel frame with original dark stretch fabric. The reclining human-form silhouette is one of the most recognizable shapes in 20th century furniture design.",
    condition_report:
      "Good. Original fabric shows minor wear. Frame is solid with no bends or rust. Recline mechanism works smoothly.",
    measurements: 'W: 24" / D: 60" / H: 30"',
    year: 1968,
    provenance: "Dealer, Lyon, France",
    item_location: "Los Angeles, CA",
    shipping_terms: "Ships within 5 business days. Domestic only.",
    brand: null,
    starting_bid: 15,
    estimate_low: 3900,
    estimate_high: 3900,
    tags: ["FURNITURE", "VINTAGE", "FRENCH DESIGN"],
    imageUrl: "https://www.figma.com/api/mcp/asset/606c9aa4-b318-467d-b38d-6bdf1b1ab43c",
  },
  {
    index: 5,
    title: "Ligne Roset Navy Togo Sectional Sofa",
    description:
      "Ligne Roset Togo sectional sofa in deep navy blue fabric. This set includes the corner module and two-seater, designed by Michel Ducaroy. The all-foam construction molds to your body for unmatched comfort.",
    condition_report:
      "Very Good. Upholstery is clean with minimal wear. Foam retains original shape and support. No stains or tears.",
    measurements: 'W: 96" / D: 68" / H: 28" (sectional)',
    year: 1980,
    provenance: "Private collection, Brussels, Belgium",
    item_location: "Los Angeles, CA",
    shipping_terms: "Local pickup or buyer arranges freight.",
    brand: null,
    starting_bid: 15,
    estimate_low: 11000,
    estimate_high: 11000,
    tags: ["FURNITURE", "VINTAGE", "FRENCH DESIGN"],
    imageUrl: "https://www.figma.com/api/mcp/asset/8703cc6b-cf8c-49d3-8846-17c9f7aa6657",
  },
  {
    index: 6,
    title: "Knoll Associates Tulip Arm Chair",
    description:
      "Eero Saarinen Tulip arm chair manufactured by Knoll Associates. Molded fiberglass shell with original purple upholstered seat cushion on white cast aluminum pedestal base. Early production with original Knoll label.",
    condition_report:
      "Good. Shell has minor surface wear. Original cushion with some fading. Base has light scratches. Knoll label intact on underside.",
    measurements: 'W: 26" / D: 23" / H: 32" / Seat H: 18"',
    year: 1960,
    provenance: "Corporate office decommission, New York, NY",
    item_location: "Los Angeles, CA",
    shipping_terms: "Ships within 5 business days. Domestic and international available.",
    brand: null,
    starting_bid: 15,
    estimate_low: 2800,
    estimate_high: 2800,
    tags: ["FURNITURE", "MID-CENTURY", "KNOLL"],
    imageUrl: "https://www.figma.com/api/mcp/asset/393d1166-864b-4b03-b98f-e644d8fe7362",
  },
  {
    index: 7,
    title: "Cross Patch Denim Jacket",
    description:
      "Chrome Hearts cross patch denim jacket. Sterling silver hardware with signature cross motifs. Heavy-weight denim with leather cross patches on back and sleeves.",
    condition_report:
      "Good. Denim shows natural wear patterns. All silver hardware intact and polished. Leather patches in excellent condition.",
    measurements: 'Chest: 22" / Length: 26" / Sleeve: 25"',
    year: null,
    provenance: null,
    item_location: "Los Angeles, CA",
    shipping_terms: "Ships within 3 business days. Domestic only.",
    brand: "CHROME HEARTS",
    starting_bid: 15,
    estimate_low: null,
    estimate_high: null,
    tags: ["CHROME HEARTS"],
    imageUrl: "https://www.figma.com/api/mcp/asset/da79d02b-614c-4aa0-9f89-c656bbdb2e82",
  },
  {
    index: 8,
    title: "Cross Patch Denim Jacket",
    description:
      "Chrome Hearts cross patch denim jacket. Sterling silver button hardware throughout. Medium wash denim with signature cross leather patches.",
    condition_report:
      "Very Good. Minimal wear. Silver hardware in excellent condition. No stains or damage.",
    measurements: 'Chest: 21" / Length: 25" / Sleeve: 24"',
    year: null,
    provenance: null,
    item_location: "Los Angeles, CA",
    shipping_terms: "Ships within 3 business days. Domestic only.",
    brand: "CHROME HEARTS",
    starting_bid: 15,
    estimate_low: null,
    estimate_high: null,
    tags: ["CHROME HEARTS"],
    imageUrl: "https://www.figma.com/api/mcp/asset/b94bc316-d001-4f41-98b5-21b6b827b2a3",
  },
  {
    index: 9,
    title: "Cross Patch Denim Jacket",
    description:
      "Chrome Hearts cross patch denim jacket in a brown/cognac leather variant. Full sterling silver snap hardware. Distressed leather cross patches throughout.",
    condition_report:
      "Good. Natural leather patina. All hardware intact. Minor scuffing on elbows consistent with wear.",
    measurements: 'Chest: 23" / Length: 27" / Sleeve: 25"',
    year: null,
    provenance: null,
    item_location: "Los Angeles, CA",
    shipping_terms: "Ships within 3 business days. Domestic only.",
    brand: "CHROME HEARTS",
    starting_bid: 15,
    estimate_low: null,
    estimate_high: null,
    tags: ["CHROME HEARTS"],
    imageUrl: "https://www.figma.com/api/mcp/asset/093a4fef-3758-463e-9ea9-6b10de0a0180",
  },
];

// ---------------------------------------------------------------------------

async function ensureBucket(): Promise<void> {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;
  if (buckets?.some((b) => b.name === BUCKET)) return;

  console.log(`→ creating public bucket "${BUCKET}"`);
  const { error: createError } = await supabaseAdmin.storage.createBucket(
    BUCKET,
    { public: true, fileSizeLimit: 10 * 1024 * 1024 }
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
    throw new Error(
      `Failed to fetch ${sourceUrl}: ${res.status} ${res.statusText}`
    );
  }
  const buf = new Uint8Array(await res.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(destPath, buf, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(destPath);
  return data.publicUrl;
}

function contentTypeFor(ext: "jpg" | "png"): string {
  return ext === "png" ? "image/png" : "image/jpeg";
}

async function main() {
  console.log("=== Seeding BASA storefront ===");

  // 1. Tenant lookup / create
  const { data: existingTenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", TENANT_SLUG)
    .maybeSingle();

  let tenantId: string;

  if (existingTenant) {
    tenantId = existingTenant.id;
    console.log(`✓ tenant exists (${tenantId})`);
  } else {
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        description: AUCTION_DESCRIPTION,
        brand_colors: { primary: "#02BE50" },
        font_display: "inter",
        font_mono: "jetbrains_mono",
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    tenantId = data.id;
    console.log(`✓ tenant created (${tenantId})`);
  }

  // 2. Storage bucket
  await ensureBucket();
  console.log(`✓ bucket "${BUCKET}" ready`);

  // 3. Upload hero (logo is rendered as text — see LOGO_ASSET comment)
  console.log("→ uploading hero image");
  const heroUrl = await uploadAsset(
    HERO_ASSET.url,
    `${TENANT_SLUG}/hero.${HERO_ASSET.ext}`,
    contentTypeFor(HERO_ASSET.ext)
  );
  const logoUrl = null;
  console.log(`  hero: ${heroUrl}`);
  console.log(`  logo: (text fallback — "BASA")`);

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
      name: TENANT_NAME,
      logo_url: logoUrl,
      hero_image_url: heroUrl,
      brand_colors: { primary: "#02BE50" },
      font_display: "inter",
      font_mono: "jetbrains_mono",
      description: AUCTION_DESCRIPTION,
    })
    .eq("id", tenantId);
  if (tenantUpdateError) throw tenantUpdateError;
  console.log("✓ tenant row updated (logo, hero, brand, fonts)");

  // 6. Check for existing auction
  const { data: existingAuction } = await supabaseAdmin
    .from("auctions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("title", AUCTION_TITLE)
    .maybeSingle();

  let auctionId: string;

  if (existingAuction) {
    auctionId = existingAuction.id;
    console.log(`✓ auction already exists (${auctionId})`);
  } else {
    const { data, error } = await supabaseAdmin
      .from("auctions")
      .insert({
        tenant_id: tenantId,
        title: AUCTION_TITLE,
        description: AUCTION_DESCRIPTION,
        status: "published",
        scheduled_date: SCHEDULED_DATE,
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    auctionId = data.id;
    console.log(`✓ auction created (${auctionId})`);
  }

  // 7. Delete existing lots + re-insert
  console.log("→ refreshing lots");
  const { error: deleteError } = await supabaseAdmin
    .from("lots")
    .delete()
    .eq("auction_id", auctionId);
  if (deleteError) throw deleteError;

  const lotsPayload = LOTS.map((lot, i) => ({
    tenant_id: tenantId,
    auction_id: auctionId,
    title: lot.title,
    description: lot.description,
    condition_report: lot.condition_report,
    measurements: lot.measurements,
    year: lot.year,
    provenance: lot.provenance,
    item_location: lot.item_location,
    shipping_terms: lot.shipping_terms,
    images: [lotImageUrls[i]],
    estimate_low: lot.estimate_low,
    estimate_high: lot.estimate_high,
    starting_bid: lot.starting_bid,
    reserve: 0,
    tags: lot.brand ? [lot.brand] : lot.tags,
    sort_order: i,
    status: "published",
  }));

  const { error: lotsInsertError } = await supabaseAdmin
    .from("lots")
    .insert(lotsPayload);
  if (lotsInsertError) throw lotsInsertError;
  console.log(`✓ inserted ${lotsPayload.length} lots`);

  console.log("\n=== Done ===");
  console.log(
    `Visit http://${TENANT_SLUG}.localhost:3000 to view the storefront.`
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
