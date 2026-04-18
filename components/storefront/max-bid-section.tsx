"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

interface MaxBidSectionProps {
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

export function MaxBidSection({
  startingBid,
  onAuthRequired,
  isAuthenticated = false,
}: MaxBidSectionProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);

  const handleSetMaxBid = () => {
    if (!isAuthenticated && onAuthRequired) {
      onAuthRequired();
      return;
    }

    const amount = parseFloat(bidAmount.replace(/[^0-9.]/g, ""));
    if (isNaN(amount) || amount <= 0) return;

    setConfirmedAmount(amount);
    setIsConfirmed(true);
  };

  const handleCancel = () => {
    setIsConfirmed(false);
    setConfirmedAmount(null);
    setBidAmount("");
  };

  if (isConfirmed && confirmedAmount !== null) {
    return (
      <div className="flex flex-col">
        {/* Confirmed max bid bar */}
        <div className="flex h-[40px] items-center justify-between rounded bg-[#ededed] px-4">
          <span
            className="text-xs uppercase tracking-[-0.02em] text-black"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            YOUR MAX BID: {formatMoney(confirmedAmount)}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] transition-colors hover:text-black"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            CANCEL
          </button>
        </div>

        {/* Confirmed button */}
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
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder={startingBid != null ? String(startingBid) : "Enter max bid"}
          className="flex-1 bg-transparent text-sm tracking-[-0.02em] text-black outline-none placeholder:text-[#9c9c9c]"
        />
      </div>

      {/* Set max bid button */}
      <button
        type="button"
        onClick={handleSetMaxBid}
        className="mt-2 flex h-[50px] items-center justify-center rounded-[2px] transition-opacity hover:opacity-90"
        style={{
          backgroundColor: "var(--storefront-primary)",
          color: "var(--storefront-badge-text)",
        }}
      >
        <span
          className="text-sm uppercase tracking-[-0.02em]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          SET MAX BID
        </span>
      </button>

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
