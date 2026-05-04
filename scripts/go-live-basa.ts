/**
 * Dev-only script: make basa's auction "happening now" end-to-end.
 *
 * 1. Finds the basa tenant's most recent auction.
 * 2. If it hasn't been published to Basta yet, creates a Basta sale + items with
 *    now-relative openDate/closingDate so items open immediately.
 * 3. Calls publishSale to flip Basta into OPEN state.
 * 4. Updates our DB: auction.status='live', went_live_at=now(),
 *    current_lot_id=<first lot>.
 *
 * Run with `pnpm go-live:basa`.
 */

import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { GraphQLClient, gql } from "graphql-request";

loadDotenv({ path: path.resolve(process.cwd(), "backend/.env") });

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASTA_MANAGEMENT_URL =
  process.env.BASTA_MANAGEMENT_API_URL ??
  "https://management.api.basta.app/graphql";
const BASTA_ACCOUNT_ID = process.env.BASTA_ACCOUNT_ID ?? "";
const BASTA_API_KEY = process.env.BASTA_API_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run from repo root; ensure backend/.env is populated."
  );
  process.exit(1);
}
if (!BASTA_ACCOUNT_ID || !BASTA_API_KEY) {
  console.error("Missing BASTA_ACCOUNT_ID or BASTA_API_KEY in backend/.env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const basta = new GraphQLClient(BASTA_MANAGEMENT_URL, {
  headers: {
    "x-account-id": BASTA_ACCOUNT_ID,
    "x-api-key": BASTA_API_KEY,
  },
});

const CREATE_SALE = gql`
  mutation CreateSale($accountID: String!, $input: CreateSaleInput!) {
    createSale(accountId: $accountID, input: $input) {
      id
      status
    }
  }
`;

const CREATE_ITEM_FOR_SALE = gql`
  mutation CreateItemForSale($accountID: String!, $input: SaleItemInput!) {
    createItemForSale(accountId: $accountID, input: $input) {
      id
      status
    }
  }
`;

const PUBLISH_SALE = gql`
  mutation PublishSale($accountID: String!, $input: PublishSaleInput!) {
    publishSale(accountId: $accountID, input: $input) {
      id
      status
    }
  }
`;

const DEFAULT_BID_INCREMENT_TABLE = [
  { lowRange: 0, highRange: 100_000, step: 2_500 },
  { lowRange: 100_000, highRange: 5_000_000, step: 10_000 },
];

const LOT_OPEN_OFFSET_MS = 5_000;
const LOT_DURATION_MS = 60 * 60_000; // 1h window — long enough for demo testing
const LOT_STAGGER_MS = 0; // all items open simultaneously; seller-driven "current"

async function main() {
  console.log("Looking up basa tenant…");
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("slug", "basa")
    .single();
  if (tenantErr || !tenant) {
    throw new Error(`basa tenant not found: ${tenantErr?.message ?? "no row"}`);
  }

  console.log("Resolving auction…");
  const { data: auctions, error: auctionsErr } = await supabase
    .from("auctions")
    .select(
      "id, title, description, status, basta_sale_id, scheduled_date, current_lot_id"
    )
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });
  if (auctionsErr) throw auctionsErr;
  if (!auctions || auctions.length === 0) {
    throw new Error("No auction exists for basa.");
  }
  const auction =
    auctions.find((a) => a.status === "live") ??
    auctions.find((a) => a.status !== "closed") ??
    auctions[0];
  console.log(`  using auction ${auction.id} (${auction.title})`);

  const { data: lots, error: lotsErr } = await supabase
    .from("lots")
    .select("id, title, description, starting_bid, reserve, sort_order, basta_item_id")
    .eq("auction_id", auction.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (lotsErr) throw lotsErr;
  if (!lots || lots.length === 0) {
    throw new Error("Auction has no lots.");
  }
  console.log(`  ${lots.length} lots`);

  let saleId = auction.basta_sale_id;
  if (!saleId) {
    console.log("Creating Basta sale…");
    const created = await basta.request<{
      createSale: { id: string; status: string };
    }>(CREATE_SALE, {
      accountID: BASTA_ACCOUNT_ID,
      input: {
        title: auction.title,
        description: auction.description ?? "",
        currency: "USD",
        closingMethod: "OVERLAPPING",
        closingTimeCountdown: 30_000,
        bidIncrementTable: { rules: DEFAULT_BID_INCREMENT_TABLE },
      },
    });
    saleId = created.createSale.id;
    console.log(`  basta sale ${saleId}`);

    const { error: updErr } = await supabase
      .from("auctions")
      .update({ basta_sale_id: saleId })
      .eq("id", auction.id);
    if (updErr) throw updErr;
  } else {
    console.log(`  reusing basta sale ${saleId}`);
  }

  const openBase = Date.now() + LOT_OPEN_OFFSET_MS;

  for (const [index, lot] of lots.entries()) {
    if (lot.basta_item_id) {
      console.log(`  lot ${index + 1}: already has basta_item_id, skipping create`);
      continue;
    }
    const openDate = new Date(openBase + index * LOT_STAGGER_MS);
    const closingDate = new Date(openDate.getTime() + LOT_DURATION_MS);
    console.log(
      `  lot ${index + 1}: creating basta item (opens ${openDate.toISOString()})`
    );
    const res = await basta.request<{
      createItemForSale: { id: string; status: string };
    }>(CREATE_ITEM_FOR_SALE, {
      accountID: BASTA_ACCOUNT_ID,
      input: {
        saleId,
        title: lot.title,
        description: lot.description ?? "",
        startingBid: Math.max(100, lot.starting_bid ?? 1000),
        reserve: lot.reserve ?? 0,
        openDate: openDate.toISOString(),
        closingDate: closingDate.toISOString(),
      },
    });
    const { error: itemErr } = await supabase
      .from("lots")
      .update({ basta_item_id: res.createItemForSale.id })
      .eq("id", lot.id);
    if (itemErr) throw itemErr;
  }

  console.log("Publishing Basta sale…");
  try {
    await basta.request<{ publishSale: { id: string; status: string } }>(
      PUBLISH_SALE,
      {
        accountID: BASTA_ACCOUNT_ID,
        input: { saleId },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (!(msg.includes("already") && msg.includes("publish"))) throw err;
    console.log("  already published — continuing");
  }

  console.log("Flipping DB to live…");
  const firstLotId = lots[0].id;
  const { error: liveErr } = await supabase
    .from("auctions")
    .update({
      status: "live",
      went_live_at: new Date().toISOString(),
      current_lot_id: firstLotId,
      scheduled_date: new Date().toISOString(),
    })
    .eq("id", auction.id);
  if (liveErr) throw liveErr;

  await supabase
    .from("lots")
    .update({ live_status: "live" })
    .eq("id", firstLotId);

  console.log("\n✅ basa is live.");
  console.log(`   auction: ${auction.id}`);
  console.log(`   basta sale: ${saleId}`);
  console.log(`   current lot: ${firstLotId}`);
  console.log("\nVisit http://basa.localhost:3000/ to see it.\n");
}

main().catch((err) => {
  console.error("go-live-basa failed:", err);
  process.exit(1);
});
