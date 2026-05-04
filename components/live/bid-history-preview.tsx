"use client";

import type { BastaLiveBid } from "@/lib/hooks/use-basta-subscription";
import { BidHistoryRow } from "./bid-history-row";

interface BidHistoryPreviewProps {
  bids: BastaLiveBid[];
  totalBidCount: number | null;
  myUserId: string | null;
  onViewAll: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(1, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function BidHistoryPreview({
  bids,
  totalBidCount,
  myUserId,
  onViewAll,
}: BidHistoryPreviewProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const preview = bids.slice(0, 3);
  const hasMore = (totalBidCount ?? bids.length) > preview.length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          LIVE BIDS
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[10px] uppercase tracking-widest text-black underline-offset-2 hover:underline"
            style={fontMono}
          >
            VIEW ALL ({totalBidCount ?? bids.length})
          </button>
        )}
      </div>
      {preview.length === 0 ? (
        <p
          className="py-3 text-xs text-[#9c9c9c]"
          style={fontMono}
        >
          No bids yet — be the first.
        </p>
      ) : (
        <div className="divide-y divide-[#f3f3f3]">
          {preview.map((bid, i) => (
            <BidHistoryRow
              key={`${bid.placedAt}-${i}`}
              amount={bid.amount}
              handle={bid.userId ? bid.userId.slice(0, 6) : "BIDDER"}
              timestamp={relativeTime(bid.placedAt)}
              isYou={Boolean(myUserId && bid.userId === myUserId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
