"use client";

import { ModalOverlay } from "@/components/storefront/modal-overlay";
import type { BastaLiveBid } from "@/lib/hooks/use-basta-subscription";
import { formatMoney } from "@/lib/format";

interface LiveBidsModalProps {
  isOpen: boolean;
  bids: BastaLiveBid[];
  myUserId: string | null;
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(1, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds} SEC AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} MIN AGO`;
  return `${Math.floor(minutes / 60)} HR AGO`;
}

export function LiveBidsModal({
  isOpen,
  bids,
  myUserId,
  onClose,
}: LiveBidsModalProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      label="LIVE BIDS"
      title={`View all live bids (${bids.length})`}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {bids.length === 0 ? (
          <p
            className="py-6 text-center text-xs text-[#9c9c9c]"
            style={fontMono}
          >
            No bids yet.
          </p>
        ) : (
          <div className="divide-y divide-[#f3f3f3]">
            {bids.map((bid, i) => {
              const isYou = Boolean(myUserId && bid.userId === myUserId);
              const isHighest = i === 0;
              const handle = bid.userId ? `@${bid.userId.slice(0, 6)}` : "@BIDDER";
              return (
                <div
                  key={`${bid.placedAt}-${i}`}
                  className={`flex items-center justify-between gap-3 py-3 text-xs ${isHighest ? "bg-[#f0fdf4]" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-[10px] uppercase text-white"
                      style={fontMono}
                    >
                      {handle.replace("@", "").slice(0, 1)}
                    </div>
                    <span
                      className="truncate text-black"
                      style={fontDisplay}
                    >
                      {isYou ? "YOU" : handle}
                    </span>
                    <span
                      className="shrink-0 text-[#9c9c9c]"
                      style={fontMono}
                    >
                      {relativeTime(bid.placedAt)}
                    </span>
                  </div>
                  <span
                    className="shrink-0 text-black"
                    style={fontMono}
                  >
                    {formatMoney(bid.amount)}
                    {isHighest ? (
                      <span className="ml-1 text-[#10b981]">(HIGHEST)</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
