"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  type LotRibbonItem,
  type StorefrontAuction,
} from "@/lib/storefront-data";
import {
  getStorefrontAuctionPhase,
  getStorefrontLotOutcome,
} from "@/lib/storefront-state";
import { pad } from "@/lib/format";

interface LotRibbonProps {
  auction: Pick<StorefrontAuction, "status" | "ended_at">;
  lots: LotRibbonItem[];
  currentLotId: string;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusChip({
  outcome,
}: {
  outcome: ReturnType<typeof getStorefrontLotOutcome>;
}) {
  if (outcome === "sold") {
    return (
      <span
        className="inline-flex items-center rounded-[2px] bg-[#848484] px-1.5 py-0.5 text-[10px] uppercase tracking-[-0.02em] text-white"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        Sold
      </span>
    );
  }
  if (outcome === "passed") {
    return (
      <span
        className="inline-flex items-center rounded-[2px] bg-[#848484] px-1.5 py-0.5 text-[10px] uppercase tracking-[-0.02em] text-white"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        Pass
      </span>
    );
  }
  if (outcome === "ended") {
    return (
      <span
        className="inline-flex items-center rounded-[2px] bg-[#ededed] px-1.5 py-0.5 text-[10px] uppercase tracking-[-0.02em] text-black"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        Ended
      </span>
    );
  }
  return null;
}

export function LotRibbon({ auction, lots, currentLotId }: LotRibbonProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const phase = getStorefrontAuctionPhase(auction);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="relative flex h-[60px] shrink-0 items-center border-b border-[#f3f3f3] bg-white">
      <button
        type="button"
        onClick={() => scroll("left")}
        className="hidden h-full w-10 shrink-0 items-center justify-center text-[#5e5e5e] transition-colors hover:text-black lg:flex"
        aria-label="Scroll left"
      >
        <ChevronLeft />
      </button>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex flex-1 items-center gap-2.5 overflow-x-auto px-4 lg:px-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {lots.map((lot, index) => {
          const isCurrent = lot.id === currentLotId;
          const outcome = getStorefrontLotOutcome(
            {
              live_status: lot.live_status,
              winning_bid_cents: lot.winning_bid_cents,
            },
            auction
          );

          return (
            <Link
              key={lot.id}
              href={`/lots/${lot.id}`}
              className={`flex h-[38px] shrink-0 items-center gap-3 rounded-[4px] border px-3 transition-colors ${
                isCurrent
                  ? "border-black"
                  : "border-[#f0f0f0] hover:border-[#d0d0d0]"
              }`}
            >
              <div className="relative h-[22px] min-w-[18px] max-w-[41px] shrink-0 overflow-hidden rounded bg-[#f3f3f3]">
                {lot.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lot.thumbnail} alt="" className="h-[22px] w-auto object-cover" />
                ) : (
                  <div className="flex h-full w-[30px] items-center justify-center">
                    <span
                      className="text-[7px] uppercase text-[#c9c9c9]"
                      style={{ fontFamily: "var(--storefront-font-mono)" }}
                    >
                      {pad(index + 1)}
                    </span>
                  </div>
                )}
              </div>

              <span
                className={`max-w-[200px] truncate whitespace-nowrap text-xs uppercase tracking-[-0.02em] text-black ${
                  phase === "ended" && (outcome === "sold" || outcome === "passed")
                    ? "line-through"
                    : ""
                }`}
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                LOT {pad(index + 1)}: {lot.title.toUpperCase()}
              </span>

              {phase === "ended" ? <StatusChip outcome={outcome} /> : null}
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scroll("right")}
        className="hidden h-full w-10 shrink-0 items-center justify-center text-[#5e5e5e] transition-colors hover:text-black lg:flex"
        aria-label="Scroll right"
      >
        <ChevronRight />
      </button>
    </div>
  );
}
