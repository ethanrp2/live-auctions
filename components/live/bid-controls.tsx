"use client";

import { formatMoney } from "@/lib/format";

export type BidControlMode =
  | "bid"
  | "winning"
  | "outbid"
  | "closed"
  | "loading";

interface BidControlsProps {
  mode: BidControlMode;
  nextBidAmountCents: number;
  onBid: () => void;
  onCustom: () => void;
  onNextLot: () => void;
  disabled?: boolean;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3 8l3.5 3.5L13 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function BidControls({
  mode,
  nextBidAmountCents,
  onBid,
  onCustom,
  onNextLot,
  disabled,
}: BidControlsProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };

  if (mode === "closed") {
    return (
      <button
        type="button"
        onClick={onNextLot}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
        style={fontMono}
      >
        NEXT LOT →
      </button>
    );
  }

  if (mode === "winning") {
    return (
      <button
        type="button"
        disabled
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded bg-black text-sm uppercase tracking-[-0.02em] text-white opacity-90"
        style={fontMono}
      >
        <CheckIcon />
        BID PLACED
      </button>
    );
  }

  if (mode === "outbid") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCustom}
          disabled={disabled}
          className="flex h-[50px] flex-1 items-center justify-center rounded border border-black text-sm uppercase tracking-[-0.02em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
          style={fontMono}
        >
          CUSTOM
        </button>
        <button
          type="button"
          onClick={onBid}
          disabled={disabled}
          className="flex h-[50px] flex-[2] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={fontMono}
        >
          BID {formatMoney(nextBidAmountCents)}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onBid}
      disabled={disabled || mode === "loading"}
      className="flex h-[50px] w-full items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={fontMono}
    >
      {mode === "loading" ? "…" : `BID ${formatMoney(nextBidAmountCents)}`}
    </button>
  );
}
