"use client";

import { formatLiveDate } from "@/lib/format";

interface AuctionStatusBarProps {
  scheduledDate: string;
  onGetAlerted?: () => void;
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 11 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-[11px]"
      aria-hidden="true"
    >
      <rect x="0.5" y="1.5" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1" />
      <line x1="0.5" y1="4" x2="10.5" y2="4" stroke="currentColor" strokeWidth="1" />
      <line x1="3" y1="0.5" x2="3" y2="2.5" stroke="currentColor" strokeWidth="1" />
      <line x1="8" y1="0.5" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function AuctionStatusBar({ scheduledDate, onGetAlerted }: AuctionStatusBarProps) {
  return (
    <div className="flex h-10 items-center justify-between bg-[#fff7e1] px-4">
      <div className="flex items-center gap-3 text-[#ff3700]">
        <CalendarIcon />
        <span
          className="text-xs uppercase tracking-[-0.02em]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          {formatLiveDate(scheduledDate)}
        </span>
      </div>
      {onGetAlerted && (
        <button
          type="button"
          onClick={onGetAlerted}
          className="flex h-[26px] items-center gap-2 rounded-[6px] border px-2 text-xs uppercase tracking-[-0.02em] transition-all"
          style={{
            fontFamily: "var(--storefront-font-mono)",
            color: "#ff3700",
            borderColor: "rgba(255,55,0,0.5)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#ff3700";
            e.currentTarget.style.color = "#fff7e1";
            e.currentTarget.style.borderColor = "#ff3700";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#ff3700";
            e.currentTarget.style.borderColor = "rgba(255,55,0,0.5)";
          }}
        >
          <CalendarIcon />
          GET ALERTED
        </button>
      )}
    </div>
  );
}
