"use client";

import { useRef } from "react";
import Link from "next/link";
import type { LotRibbonItem } from "@/lib/storefront-data";
import { pad } from "@/lib/format";

interface LotRibbonProps {
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

export function LotRibbon({ lots, currentLotId }: LotRibbonProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="relative flex h-[60px] shrink-0 items-center border-b border-[#f3f3f3] bg-white">
      {/* Left arrow (desktop only) */}
      <button
        type="button"
        onClick={() => scroll("left")}
        className="hidden lg:flex h-full w-10 shrink-0 items-center justify-center text-[#5e5e5e] transition-colors hover:text-black"
        aria-label="Scroll left"
      >
        <ChevronLeft />
      </button>

      {/* Scrollable lot strip */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-center gap-2.5 overflow-x-auto px-4 lg:px-0 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {lots.map((lot, index) => {
          const isCurrent = lot.id === currentLotId;
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
              {/* Thumbnail — wide rounded rectangle */}
              <div className="relative h-[22px] min-w-[18px] max-w-[41px] shrink-0 overflow-hidden rounded bg-[#f3f3f3]">
                {lot.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lot.thumbnail}
                    alt=""
                    className="h-[22px] w-auto object-cover"
                  />
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

              {/* Lot number + title */}
              <span
                className="max-w-[200px] truncate text-xs uppercase tracking-[-0.02em] whitespace-nowrap text-black"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                LOT {pad(index + 1)}: {lot.title.toUpperCase()}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right arrow (desktop only) */}
      <button
        type="button"
        onClick={() => scroll("right")}
        className="hidden lg:flex h-full w-10 shrink-0 items-center justify-center text-[#5e5e5e] transition-colors hover:text-black"
        aria-label="Scroll right"
      >
        <ChevronRight />
      </button>
    </div>
  );
}
