import Link from "next/link";
import type { StorefrontAuction, StorefrontLot } from "@/lib/storefront-data";
import {
  getStorefrontLotOutcome,
  getWinnerDisplayLabel,
} from "@/lib/storefront-state";
import { pad, formatMoneyCents, formatEstimateCents } from "@/lib/format";

interface LotCardProps {
  auction: StorefrontAuction;
  lot: StorefrontLot;
  index: number;
  total: number;
}

function getBadgeCopy(auction: StorefrontAuction, lot: StorefrontLot): string {
  const outcome = getStorefrontLotOutcome(lot, auction);

  if (outcome === "sold") {
    return `SOLD FOR ${formatMoneyCents(lot.winning_bid_cents)}`;
  }
  if (outcome === "passed") {
    return "PASSED";
  }
  if (outcome === "ended") {
    return "NO SALE";
  }
  if (auction.status === "live") {
    return `OPENING ${formatMoneyCents(lot.starting_bid)}`;
  }
  return `STARTS: ${formatMoneyCents(lot.starting_bid)}`;
}

function getMetaCopy(auction: StorefrontAuction, lot: StorefrontLot): string {
  const outcome = getStorefrontLotOutcome(lot, auction);

  if (outcome === "sold") {
    return `WINNER: ${getWinnerDisplayLabel(lot)}`;
  }
  if (outcome === "passed") {
    return "LOT PASSED";
  }
  if (outcome === "ended") {
    return "AUCTION ENDED";
  }
  return `EST: ${formatEstimateCents(lot.estimate_low, lot.estimate_high)}`;
}

export function LotCard({ auction, lot, index, total }: LotCardProps) {
  const cover = lot.images[0];

  return (
    <Link href={`/lots/${lot.id}`} className="block">
      <article className="flex h-[380px] flex-col overflow-hidden rounded-md border border-[#f3f3f3] bg-white transition-shadow hover:shadow-md">
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-[#f3f3f3] bg-white px-4 py-3">
          <span
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            LOT {pad(index + 1)} OF {pad(total)}
          </span>
          <span
            className="flex items-center rounded px-2 py-1"
            style={{ backgroundColor: "var(--storefront-primary)" }}
          >
            <span
              className="text-xs"
              style={{
                fontFamily: "var(--storefront-font-mono)",
                color: "var(--storefront-badge-text)",
              }}
            >
              {getBadgeCopy(auction, lot)}
            </span>
          </span>
        </header>

        <div className="relative min-h-0 flex-1 border-b border-[#f3f3f3] bg-white">
          {cover ? (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt={lot.title} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-[#c9c9c9]"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              No image
            </div>
          )}
        </div>

        <footer className="flex flex-col justify-center gap-1 p-3">
          {lot.brand ? (
            <>
              <span
                className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                {lot.brand}
              </span>
              <h3
                className="truncate text-base text-black"
                style={{ fontFamily: "var(--storefront-font-display)" }}
              >
                {lot.title}
              </h3>
            </>
          ) : (
            <h3
              className="truncate text-base text-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            >
              {lot.title}
            </h3>
          )}

          <p
            className="text-xs tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            {getMetaCopy(auction, lot)}
          </p>
        </footer>
      </article>
    </Link>
  );
}
