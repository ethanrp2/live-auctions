"use client";

import type { Tenant } from "@/lib/tenant";

interface ConsoleHeaderProps {
  tenant: Tenant;
  auctionTitle: string;
  status: string;
  watchingCount: number;
  muted: boolean;
  onToggleMute: () => void;
  onEndAuction: () => void;
}

function VolumeOn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M11 5L6 9H2v6h4l5 4V5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8.5a5 5 0 010 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VolumeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M11 5L6 9H2v6h4l5 4V5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 9l5 6M21 9l-5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConsoleHeader({
  tenant,
  auctionTitle,
  status,
  watchingCount,
  muted,
  onToggleMute,
  onEndAuction,
}: ConsoleHeaderProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const isLive = status === "live";

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-[#1a1a1a] bg-black px-5 text-white">
      <div className="flex items-center gap-3">
        <span
          className="text-[11px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          AUCTION MANAGER
        </span>
        <span
          className="text-[11px] uppercase tracking-widest text-white"
          style={fontMono}
        >
          • {tenant.name.toUpperCase()} — {auctionTitle.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isLive && (
          <span
            className="inline-flex items-center gap-2 rounded-full bg-[#dc2626] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white"
            style={fontMono}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            LIVE
          </span>
        )}
        <span
          className="text-[11px] uppercase tracking-widest text-white"
          style={fontMono}
        >
          {watchingCount} WATCHING
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#262626] text-white transition-colors hover:bg-[#1a1a1a]"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeOff /> : <VolumeOn />}
        </button>
        <button
          type="button"
          onClick={onEndAuction}
          className="h-8 rounded-md border border-[#262626] px-3 text-[11px] uppercase tracking-[-0.02em] text-white transition-colors hover:bg-[#1a1a1a]"
          style={fontMono}
        >
          END AUCTION
        </button>
      </div>
    </header>
  );
}
