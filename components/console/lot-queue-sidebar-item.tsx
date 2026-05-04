"use client";

import type { LiveLot } from "@/lib/live-auction-data";
import { formatMoney, pad } from "@/lib/format";

type QueueStatus = "sold" | "passed" | "live" | "next" | "upcoming";

interface LotQueueSidebarItemProps {
  lot: LiveLot;
  index: number;
  status: QueueStatus;
  isCurrent: boolean;
  onClick: () => void;
}

export function LotQueueSidebarItem({
  lot,
  index,
  status,
  isCurrent,
  onClick,
}: LotQueueSidebarItemProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };

  let statusLine: React.ReactNode = null;
  switch (status) {
    case "sold":
      statusLine = (
        <span className="text-[10px] uppercase tracking-widest text-[#5e5e5e]" style={fontMono}>
          SOLD {lot.winning_bid_cents != null ? formatMoney(lot.winning_bid_cents) : ""}
        </span>
      );
      break;
    case "passed":
      statusLine = (
        <span className="text-[10px] uppercase tracking-widest text-[#5e5e5e]" style={fontMono}>
          PASSED
        </span>
      );
      break;
    case "live":
      statusLine = (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#dc2626]" style={fontMono}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
          LIVE
        </span>
      );
      break;
    case "next":
      statusLine = (
        <span className="text-[10px] uppercase tracking-widest text-black" style={fontMono}>
          NEXT
        </span>
      );
      break;
    default:
      statusLine = (
        <span className="text-[10px] uppercase tracking-widest text-[#9c9c9c]" style={fontMono}>
          UPCOMING
        </span>
      );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[#f3f3f3] px-3 py-2.5 text-left transition-colors ${
        isCurrent
          ? "border-l-2 border-l-[#dc2626] bg-[#fafafa]"
          : "border-l-2 border-l-transparent hover:bg-[#fafafa]"
      }`}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-[#f3f3f3]">
        {lot.images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lot.images[0]} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          LOT {pad(index + 1)}
        </div>
        <div
          className={`truncate text-xs uppercase tracking-[-0.02em] ${status === "sold" || status === "passed" ? "text-[#9c9c9c] line-through" : "text-black"}`}
          style={fontMono}
        >
          {lot.title.toUpperCase()}
        </div>
        <div className="mt-0.5">{statusLine}</div>
      </div>
    </button>
  );
}
