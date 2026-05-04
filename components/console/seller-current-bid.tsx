import { formatMoney } from "@/lib/format";
import { LiveCountdown } from "@/components/live/live-countdown";

interface SellerCurrentBidProps {
  currentBidCents: number | null;
  startingBidCents: number | null;
  bidCount: number | null;
  timeRemaining: number | null;
  maxBidCount: number;
  highestMaxBidCents: number | null;
}

export function SellerCurrentBid({
  currentBidCents,
  startingBidCents,
  bidCount,
  timeRemaining,
  maxBidCount,
  highestMaxBidCents,
}: SellerCurrentBidProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };
  const hasBid = currentBidCents != null && currentBidCents > 0;
  const display = hasBid ? currentBidCents : startingBidCents;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-md bg-[#fef3c7] px-3 py-2 text-xs">
        <span
          className="uppercase tracking-[-0.02em] text-[#8a6d3b]"
          style={fontMono}
        >
          {maxBidCount} MAX BID{maxBidCount === 1 ? "" : "S"} ON THIS LOT
        </span>
        {highestMaxBidCents != null && (
          <span
            className="uppercase tracking-[-0.02em] text-[#8a6d3b]"
            style={fontMono}
          >
            HIGHEST: {formatMoney(highestMaxBidCents)}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <span
            className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
            style={fontMono}
          >
            {hasBid ? "CURRENT BID" : "STARTING BID"}
          </span>
          <div
            className="text-3xl leading-tight tracking-[-0.02em] text-black"
            style={fontDisplay}
          >
            {formatMoney(display)}
          </div>
          {bidCount != null && bidCount > 0 && (
            <span
              className="text-[10px] uppercase tracking-widest text-[#5e5e5e]"
              style={fontMono}
            >
              {bidCount} {bidCount === 1 ? "BID" : "BIDS"}
            </span>
          )}
        </div>
        <LiveCountdown timeRemaining={timeRemaining} />
      </div>
    </div>
  );
}
