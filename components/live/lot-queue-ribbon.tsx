"use client";

import { useEffect, useRef } from "react";
import type { LiveLot } from "@/lib/live-auction-data";
import { LotQueueItem } from "./lot-queue-item";

interface LotQueueRibbonProps {
  lots: LiveLot[];
  currentLotId: string | null;
  focusLotId: string | null;
  onSelect: (lotId: string) => void;
}

function statusFor(lot: LiveLot, isCurrent: boolean, isNext: boolean) {
  if (lot.live_status === "sold") return "sold" as const;
  if (lot.live_status === "passed") return "passed" as const;
  if (isCurrent) return "live" as const;
  if (isNext) return "next" as const;
  return "upcoming" as const;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 3L5 8L10 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 3L11 8L6 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LotQueueRibbon({
  lots,
  currentLotId,
  focusLotId,
  onSelect,
}: LotQueueRibbonProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentIndex = lots.findIndex((l) => l.id === currentLotId);
  const nextIndex =
    currentIndex >= 0
      ? lots.findIndex(
          (l, i) => i > currentIndex && l.live_status !== "sold" && l.live_status !== "passed"
        )
      : -1;

  useEffect(() => {
    const id = focusLotId ?? currentLotId;
    if (!id || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-lot-id="${id}"]`
    );
    if (el && "scrollIntoView" in el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [focusLotId, currentLotId]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -240 : 240;
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
        {lots.map((lot, index) => (
          <LotQueueItem
            key={lot.id}
            lot={lot}
            index={index}
            status={statusFor(lot, index === currentIndex, index === nextIndex)}
            isCurrent={lot.id === (focusLotId ?? currentLotId)}
            onClick={() => onSelect(lot.id)}
          />
        ))}
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
