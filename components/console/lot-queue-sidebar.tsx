"use client";

import type { LiveLot } from "@/lib/live-auction-data";
import { LotQueueSidebarItem } from "./lot-queue-sidebar-item";

interface LotQueueSidebarProps {
  lots: LiveLot[];
  currentLotId: string | null;
  onSelect: (lotId: string) => void;
}

function statusFor(
  lot: LiveLot,
  isCurrent: boolean,
  isNext: boolean
): "sold" | "passed" | "live" | "next" | "upcoming" {
  if (lot.live_status === "sold") return "sold";
  if (lot.live_status === "passed") return "passed";
  if (isCurrent) return "live";
  if (isNext) return "next";
  return "upcoming";
}

export function LotQueueSidebar({
  lots,
  currentLotId,
  onSelect,
}: LotQueueSidebarProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const currentIdx = lots.findIndex((l) => l.id === currentLotId);
  const nextIdx =
    currentIdx >= 0
      ? lots.findIndex(
          (l, i) =>
            i > currentIdx &&
            l.live_status !== "sold" &&
            l.live_status !== "passed"
        )
      : -1;

  const currentPosition = currentIdx >= 0 ? currentIdx + 1 : 0;

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[#f3f3f3] bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-[#f3f3f3] px-3 py-2.5">
        <span
          className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          LOT QUEUE
        </span>
        <span
          className="text-[10px] uppercase tracking-widest text-[#5e5e5e]"
          style={fontMono}
        >
          {currentPosition} OF {lots.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lots.map((lot, index) => (
          <LotQueueSidebarItem
            key={lot.id}
            lot={lot}
            index={index}
            status={statusFor(lot, index === currentIdx, index === nextIdx)}
            isCurrent={lot.id === currentLotId}
            onClick={() => onSelect(lot.id)}
          />
        ))}
      </div>
    </aside>
  );
}
