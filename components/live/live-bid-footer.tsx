"use client";

import { formatMoneyCents } from "@/lib/format";
import { CountdownPill } from "@/components/live/countdown-pill";

export type LiveViewerState =
  | { kind: "idle" }
  | { kind: "winning" }
  | { kind: "outbid" }
  | { kind: "sold"; winnerHandle: string; winningPriceCents: number }
  | { kind: "passed" }
  | { kind: "paused" };

export interface LiveBidFooterProps {
  currentBidCents: number | null;
  nextIncrementBidCents: number | null;
  countdownMs: number | null;
  viewerState: LiveViewerState;
  onOneTapBid: () => Promise<void> | void;
  onOpenCustomBid: () => void;
  onOpenMaxBid: () => void;
  isPlacing: boolean;
  lastError: string | null;
}

function ctaLabel(
  viewerState: LiveViewerState,
  nextIncrementBidCents: number | null,
  isPlacing: boolean,
  isAuthenticated: boolean = true
): string {
  if (isPlacing) return "PLACING BID…";
  if (viewerState.kind === "paused") return "PAUSED";
  if (viewerState.kind === "passed") return "PASSED";
  if (viewerState.kind === "sold") return "SOLD";
  if (!isAuthenticated) return "SIGN IN TO BID";
  if (viewerState.kind === "outbid") {
    return nextIncrementBidCents != null
      ? `BID ${formatMoneyCents(nextIncrementBidCents)} NOW`
      : "BID NOW";
  }
  return nextIncrementBidCents != null
    ? `BID ${formatMoneyCents(nextIncrementBidCents)}`
    : "BID";
}

export function LiveBidFooter({
  currentBidCents,
  nextIncrementBidCents,
  countdownMs,
  viewerState,
  onOneTapBid,
  onOpenCustomBid,
  onOpenMaxBid,
  isPlacing,
  lastError,
}: LiveBidFooterProps) {
  const isSold = viewerState.kind === "sold";
  const isPassed = viewerState.kind === "passed";
  const isPaused = viewerState.kind === "paused";
  const ctaDisabled = isPlacing || isSold || isPassed || isPaused;

  if (isPassed) {
    return (
      <div
        className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-[#f3f3f3] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <div className="flex h-[50px] items-center justify-center rounded-[2px] bg-black px-4">
          <span className="text-sm uppercase tracking-[-0.02em] text-white">
            PASSED
          </span>
        </div>
      </div>
    );
  }

  if (isSold) {
    return (
      <div
        className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-[#f3f3f3] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <div className="flex h-[50px] items-center justify-center rounded-[2px] bg-black px-4">
          <span className="text-sm uppercase tracking-[-0.02em] text-white">
            SOLD — {formatMoneyCents(viewerState.winningPriceCents)} TO @
            {viewerState.winnerHandle.toUpperCase()}
          </span>
        </div>
        <p
          className="text-center text-xs text-[#5e5e5e]"
          style={{ fontFamily: "var(--storefront-font-display)" }}
        >
          By bidding you agree to the Terms of Sale.
        </p>
      </div>
    );
  }

  return (
    <div
      className="sticky bottom-0 z-10 flex flex-col gap-5 border-t border-[#f3f3f3] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      style={{ fontFamily: "var(--storefront-font-mono)" }}
    >
      {/* Row 1 — current bid + countdown */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]">
            CURRENT BID
          </span>
          <span
            className="text-[40px] font-medium leading-none tracking-[-0.02em] text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            {formatMoneyCents(currentBidCents)}
          </span>
        </div>
        {countdownMs != null && <CountdownPill countdownMs={countdownMs} />}
      </div>

      {/* Row 2 — primary CTA */}
      <button
        type="button"
        onClick={() => {
          void onOneTapBid();
        }}
        disabled={ctaDisabled}
        className="flex h-[50px] items-center justify-center rounded-[2px] bg-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <span className="text-sm uppercase tracking-[-0.02em] text-white">
          {ctaLabel(viewerState, nextIncrementBidCents, isPlacing)}
        </span>
      </button>

      {/* Secondary affordances — custom / max bid */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onOpenCustomBid}
          disabled={isPlacing || isPassed || isPaused}
          className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e] underline transition-colors hover:text-black disabled:opacity-60"
        >
          CUSTOM AMOUNT
        </button>
        <span className="text-[11px] text-[#5e5e5e]">·</span>
        <button
          type="button"
          onClick={onOpenMaxBid}
          disabled={isPlacing || isPassed || isPaused}
          className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e] underline transition-colors hover:text-black disabled:opacity-60"
        >
          SET MAX BID
        </button>
      </div>

      {/* Error row */}
      {lastError && (
        <p
          className="-mt-2 text-center text-xs text-[#c11]"
          role="alert"
        >
          {lastError}
        </p>
      )}

      {/* Row 3 — fine print */}
      <p
        className="text-center text-xs text-[#5e5e5e]"
        style={{ fontFamily: "var(--storefront-font-display)" }}
      >
        By bidding you agree to the Terms of Sale.
      </p>
    </div>
  );
}
