"use client";

import type { BastaLiveBid } from "@/lib/hooks/use-basta-subscription";
import { formatMoney } from "@/lib/format";

interface ConsoleLiveBidsProps {
  bids: BastaLiveBid[];
  totalCount: number | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(1, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds} SEC AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} MIN AGO`;
  return `${Math.floor(minutes / 60)} HR AGO`;
}

export function ConsoleLiveBids({ bids, totalCount }: ConsoleLiveBidsProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-[#f3f3f3]">
      <div className="flex shrink-0 items-center justify-between px-4 py-2">
        <span
          className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          LIVE BIDS
        </span>
        <span
          className="text-[10px] uppercase tracking-widest text-black"
          style={fontMono}
        >
          VIEW ALL ({totalCount ?? bids.length})
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {bids.length === 0 ? (
          <p
            className="px-4 py-3 text-xs text-[#9c9c9c]"
            style={fontMono}
          >
            No bids yet.
          </p>
        ) : (
          bids.map((bid, i) => (
            <div
              key={`${bid.placedAt}-${i}`}
              className="flex items-center justify-between gap-3 border-t border-[#f3f3f3] px-4 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10b981] text-[9px] uppercase text-white"
                  style={fontMono}
                >
                  B
                </div>
                <span
                  className="uppercase tracking-[-0.02em] text-black"
                  style={fontMono}
                >
                  @BIDDER
                </span>
                <span
                  className="uppercase tracking-widest text-[#9c9c9c]"
                  style={fontMono}
                >
                  {relativeTime(bid.placedAt)}
                </span>
              </div>
              <span
                className="uppercase tracking-[-0.02em] text-black"
                style={fontMono}
              >
                {formatMoney(bid.amount)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
