"use client";

import { formatMoneyCents } from "@/lib/format";

export interface BidFeedEntry {
  id: string;
  userId: string;
  handle: string;
  amountCents: number;
  placedAt: string;
  isCurrentUser: boolean;
}

export interface LiveBidHistoryProps {
  bids: BidFeedEntry[];
  totalCount: number;
  onViewAll: () => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds} SEC AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR AGO`;
  const days = Math.floor(hours / 24);
  return `${days} D AGO`;
}

function BidRow({ bid, opacityClass }: { bid: BidFeedEntry; opacityClass: string }) {
  return (
    <div className={`flex items-center justify-between ${opacityClass}`}>
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 shrink-0 rounded-full bg-[#d9d9d9]" aria-hidden="true" />
        <span
          className="text-[11px] uppercase tracking-[-0.02em] text-black"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          {bid.handle.toUpperCase()}
        </span>
        <span
          className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          {relativeTime(bid.placedAt)}
        </span>
      </div>
      <span
        className="text-[11px] uppercase tracking-[-0.02em] text-black"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {formatMoneyCents(bid.amountCents)}
      </span>
    </div>
  );
}

export function LiveBidHistory({
  bids,
  totalCount,
  onViewAll,
}: LiveBidHistoryProps) {
  const visible = bids.slice(0, 2);
  return (
    <div className="relative flex flex-col gap-2 border-b border-[#f3f3f3] p-5">
      <div className="flex items-center justify-between">
        <span
          className="text-xs uppercase tracking-[-0.02em] text-black"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          Bid History
        </span>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] underline"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          View all ({totalCount})
        </button>
      </div>

      <div className="relative flex flex-col gap-2">
        {visible[0] ? (
          <BidRow bid={visible[0]} opacityClass="opacity-100" />
        ) : null}
        {visible[1] ? (
          <BidRow bid={visible[1]} opacityClass="opacity-40" />
        ) : null}
        {/* white→transparent gradient fade mask at top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[58px] bg-gradient-to-b from-white to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
