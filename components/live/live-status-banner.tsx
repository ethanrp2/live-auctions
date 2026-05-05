"use client";

import { formatMoneyCents } from "@/lib/format";

export type LiveBannerKind = "winning" | "outbid" | "sold" | "passed" | "paused";

export interface LiveStatusBannerProps {
  kind: LiveBannerKind;
  winnerHandle?: string;
  winningPriceCents?: number;
}

export function LiveStatusBanner({
  kind,
  winnerHandle,
  winningPriceCents,
}: LiveStatusBannerProps) {
  let bg = "";
  let text = "";
  let label = "";

  if (kind === "winning") {
    bg = "bg-[#00a65a]";
    text = "text-white";
    label = "You're winning";
  } else if (kind === "outbid") {
    bg = "bg-black";
    text = "text-[#ff5e61]";
    label = "You're outbid";
  } else if (kind === "sold") {
    bg = "bg-black";
    text = "text-white";
    const price =
      winningPriceCents != null ? ` \u2014 ${formatMoneyCents(winningPriceCents)}` : "";
    const handle = winnerHandle ? ` to @${winnerHandle.replace(/^@/, "").toUpperCase()}` : "";
    label = `Sold${price}${handle}`;
  } else if (kind === "passed") {
    bg = "bg-black";
    text = "text-white";
    label = "Passed";
  } else {
    bg = "bg-[#5e5e5e]";
    text = "text-white";
    label = "Auction paused";
  }

  return (
    <div
      className={`flex h-9 w-full shrink-0 items-center justify-center px-4 ${bg}`}
    >
      <span
        className={`truncate text-xs uppercase tracking-[-0.02em] ${text}`}
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {label}
      </span>
    </div>
  );
}
