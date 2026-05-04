import { formatMoney } from "@/lib/format";
import { LiveCountdown } from "./live-countdown";

interface CurrentBidDisplayProps {
  currentBidCents: number | null;
  startingBidCents: number | null;
  timeRemaining: number | null;
  bidCount: number | null;
}

export function CurrentBidDisplay({
  currentBidCents,
  startingBidCents,
  timeRemaining,
  bidCount,
}: CurrentBidDisplayProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };
  const hasBid = currentBidCents != null && currentBidCents > 0;
  const display = hasBid ? currentBidCents : startingBidCents;

  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex flex-col">
        <span
          className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          {hasBid ? "CURRENT BID" : "STARTING BID"}
        </span>
        <span
          className="text-3xl leading-tight tracking-[-0.02em] text-black"
          style={fontDisplay}
        >
          {formatMoney(display)}
        </span>
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
  );
}
