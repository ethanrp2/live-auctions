import { formatMoney } from "@/lib/format";

interface BidHistoryRowProps {
  amount: number;
  handle: string;
  timestamp: string;
  isYou?: boolean;
}

export function BidHistoryRow({
  amount,
  handle,
  timestamp,
  isYou,
}: BidHistoryRowProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f3f3f3] text-[10px] uppercase text-[#5e5e5e]" style={fontMono}>
          {handle.slice(0, 1)}
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
          {timestamp}
        </span>
      </div>
      <span
        className="shrink-0 text-black"
        style={fontMono}
      >
        {formatMoney(amount)}
      </span>
    </div>
  );
}
