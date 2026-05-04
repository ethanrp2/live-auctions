"use client";

import { pad } from "@/lib/format";
import type { LiveLot } from "@/lib/live-auction-data";

type QueueStatus = "sold" | "passed" | "live" | "next" | "upcoming";

interface LotQueueItemProps {
  lot: LiveLot;
  index: number;
  status: QueueStatus;
  isCurrent: boolean;
  onClick: () => void;
}

const BADGE_COPY: Record<QueueStatus, string> = {
  sold: "SOLD",
  passed: "PASSED",
  live: "LIVE",
  next: "NEXT",
  upcoming: "",
};

const BADGE_CLASS: Record<QueueStatus, string> = {
  sold: "bg-[#f3f3f3] text-[#5e5e5e]",
  passed: "bg-[#f3f3f3] text-[#5e5e5e]",
  live: "bg-[#dc2626] text-white",
  next: "bg-black text-white",
  upcoming: "",
};

export function LotQueueItem({
  lot,
  index,
  status,
  isCurrent,
  onClick,
}: LotQueueItemProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const badge = BADGE_COPY[status];

  return (
    <button
      type="button"
      data-lot-id={lot.id}
      onClick={onClick}
      className={`flex h-[38px] shrink-0 items-center gap-3 rounded-[4px] border px-3 transition-colors ${
        isCurrent
          ? "border-black"
          : "border-[#f0f0f0] hover:border-[#d0d0d0]"
      }`}
    >
      <div className="relative h-[22px] min-w-[18px] max-w-[41px] shrink-0 overflow-hidden rounded bg-[#f3f3f3]">
        {lot.images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lot.images[0]}
            alt=""
            className="h-[22px] w-auto object-cover"
          />
        ) : (
          <div className="flex h-full w-[30px] items-center justify-center">
            <span
              className="text-[7px] uppercase text-[#c9c9c9]"
              style={fontMono}
            >
              {pad(index + 1)}
            </span>
          </div>
        )}
      </div>

      <span
        className="max-w-[200px] truncate whitespace-nowrap text-xs uppercase tracking-[-0.02em] text-black"
        style={fontMono}
      >
        LOT {pad(index + 1)}: {lot.title.toUpperCase()}
      </span>

      {badge && (
        <span
          className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${BADGE_CLASS[status]}`}
          style={fontMono}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
