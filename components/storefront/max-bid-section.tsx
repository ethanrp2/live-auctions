"use client";

import { useState } from "react";
import { formatMoneyCents, parseDollarsToCents } from "@/lib/format";
import { useUser } from "@/lib/hooks/use-user";
import { getBastaToken } from "@/lib/basta-token";
import { fetchBidSupport } from "@/lib/basta/bid-support";
import { bidOnItem, bidErrorMessage } from "@/lib/basta/client";

interface MaxBidSectionProps {
  /** Lot UUID — used to resolve Basta saleId + itemId via bid-support endpoint. */
  lotId: string;
  /** Starting bid in integer cents. See docs/memory/architecture/money-units.md. */
  startingBid: number | null;
  onAuthRequired?: () => void;
  isAuthenticated?: boolean;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 11 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-2 w-[11px]"
      aria-hidden="true"
    >
      <path
        d="M1 3.5L4 6.5L10 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type BidState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; amountCents: number }
  | { status: "error"; message: string };

export function MaxBidSection({
  lotId,
  startingBid,
  onAuthRequired,
  isAuthenticated = false,
}: MaxBidSectionProps) {
  const { session } = useUser();
  const [bidAmount, setBidAmount] = useState("");
  const [state, setState] = useState<BidState>({ status: "idle" });
  const canBid = isAuthenticated || Boolean(session?.access_token);

  async function placeMaxBid() {
    // Auth gate — the modal flow in <LotInfoPanel> drives this.
    if (!canBid || !session?.access_token) {
      if (onAuthRequired) onAuthRequired();
      return;
    }

    let cents: number;
    try {
      cents = parseDollarsToCents(bidAmount);
    } catch {
      setState({
        status: "error",
        message: "Enter a valid dollar amount.",
      });
      return;
    }
    if (cents <= 0) {
      setState({ status: "error", message: "Bid must be greater than $0." });
      return;
    }

    setState({ status: "submitting" });

    try {
      // 1. Resolve Basta saleId/itemId via our backend helper.
      const support = await fetchBidSupport(lotId);

      // 2. Mint (or reuse cached) Basta bidder token.
      const bidderToken = await getBastaToken(session.access_token);

      // 3. Fire bidOnItem(type: MAX). Token refresh-and-retry on expired token:
      //    the token helper caches with a 5-minute buffer, so expiry is rare,
      //    but we handle it defensively once.
      let result = await bidOnItem({
        bidderToken,
        saleId: support.saleId,
        itemId: support.itemId,
        amount: cents,
        type: "MAX",
      });

      if (
        !result.ok &&
        (result.errorCode === "INVALID_TOKEN" ||
          result.errorCode === "UNAUTHORIZED")
      ) {
        // Force a fresh token and retry once.
        const refreshed = await getBastaToken(session.access_token);
        result = await bidOnItem({
          bidderToken: refreshed,
          saleId: support.saleId,
          itemId: support.itemId,
          amount: cents,
          type: "MAX",
        });
      }

      if (!result.ok) {
        setState({
          status: "error",
          message: bidErrorMessage(result.errorCode, result.error),
        });
        return;
      }

      setState({ status: "success", amountCents: result.amount });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not place bid. Please try again.",
      });
    }
  }

  function resetBid() {
    setState({ status: "idle" });
    setBidAmount("");
  }

  // --- Success state: max bid placed ---
  if (state.status === "success") {
    return (
      <div className="flex flex-col">
        <div className="flex h-[40px] items-center justify-between rounded bg-[#ededed] px-4">
          <span
            className="text-xs uppercase tracking-[-0.02em] text-black"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            YOUR MAX BID: {formatMoneyCents(state.amountCents)}
          </span>
          <button
            type="button"
            onClick={resetBid}
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] transition-colors hover:text-black"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            NEW BID
          </button>
        </div>

        <button
          type="button"
          disabled
          className="mt-2 flex h-[50px] items-center justify-center gap-2.5 rounded-[2px]"
          style={{
            backgroundColor: "var(--storefront-primary)",
            color: "var(--storefront-badge-text)",
          }}
        >
          <CheckIcon />
          <span
            className="text-sm uppercase tracking-[-0.02em]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            MAX BID SET
          </span>
        </button>
      </div>
    );
  }

  // --- Idle / submitting / error: input + CTA ---
  const submitting = state.status === "submitting";

  return (
    <div className="flex flex-col">
      {/* Bid input */}
      <div
        className="flex h-[50px] items-center gap-2.5 rounded-[2px] border border-[#bababa] px-4"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <span className="text-sm tracking-[-0.02em] text-black">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={bidAmount}
          onChange={(e) => {
            setBidAmount(e.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          placeholder={
            startingBid != null
              ? String(Math.round(startingBid / 100))
              : "Enter max bid"
          }
          className="flex-1 bg-transparent text-sm tracking-[-0.02em] text-black outline-none placeholder:text-[#9c9c9c]"
          disabled={submitting}
        />
      </div>

      {/* Set max bid button */}
      <button
        type="button"
        onClick={placeMaxBid}
        disabled={submitting}
        className="mt-2 flex h-[50px] items-center justify-center rounded-[2px] transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          backgroundColor: "var(--storefront-primary)",
          color: "var(--storefront-badge-text)",
        }}
      >
        <span
          className="text-sm uppercase tracking-[-0.02em]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          {submitting ? "PLACING BID…" : "SET MAX BID"}
        </span>
      </button>

      {/* Error message */}
      {state.status === "error" && (
        <p
          className="mt-2 text-center text-xs text-[#c11]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
          role="alert"
        >
          {state.message}
        </p>
      )}

      {/* Helper text */}
      <p
        className="mt-3 text-center text-xs text-[#5e5e5e]"
        style={{ fontFamily: "var(--storefront-font-display)" }}
      >
        We&apos;ll bid for you. You&apos;ll pay one increment above the second-highest bid.
      </p>
    </div>
  );
}
