"use client";

import { useEffect, useMemo, useState } from "react";
import type { StorefrontAuction } from "@/lib/storefront-data";
import { getStorefrontAuctionPhase } from "@/lib/storefront-state";
import { formatAuctionScheduleDate, formatElapsedSince, formatLiveDate } from "@/lib/format";

interface AuctionStatusBarProps {
  auction: Pick<StorefrontAuction, "status" | "scheduled_date" | "went_live_at" | "ended_at">;
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

export function AuctionStatusBar({ auction, onGetAlerted }: AuctionStatusBarProps) {
  const [, setTick] = useState(0);
  const phase = getStorefrontAuctionPhase(auction);

  useEffect(() => {
    if (phase !== "live") return;
    const intervalId = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(intervalId);
  }, [phase]);

  const label = useMemo(() => {
    if (phase === "ended") {
      return `ENDED ${formatAuctionScheduleDate(auction.ended_at ?? auction.scheduled_date)}`;
    }
    if (phase === "live") {
      return `LIVE NOW · ${formatElapsedSince(auction.went_live_at ?? auction.scheduled_date)} ELAPSED`;
    }
    return formatLiveDate(auction.scheduled_date);
  }, [auction.ended_at, auction.scheduled_date, auction.went_live_at, phase]);

  const showAlertButton = phase === "upcoming" && onGetAlerted;
  const barClass =
    phase === "ended"
      ? "bg-[#f5f5f5] text-black"
      : phase === "live"
        ? "bg-black text-white"
        : "bg-[#fff7e1] text-[#ff3700]";

  return (
    <div className={`flex h-10 items-center justify-between px-4 ${barClass}`}>
      <div className="flex items-center gap-3">
        <CalendarIcon />
        <span
          className="text-xs uppercase tracking-[-0.02em]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          {label}
        </span>
      </div>
      {showAlertButton && (
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
