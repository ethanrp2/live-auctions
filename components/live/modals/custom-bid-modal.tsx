"use client";

import { useEffect, useState } from "react";
import { ModalOverlay } from "@/components/storefront/modal-overlay";
import {
  centsToDollarsString,
  dollarsInputToCents,
  formatMoney,
} from "@/lib/format";
import { LiveCountdown } from "../live-countdown";

interface CustomBidModalProps {
  isOpen: boolean;
  minimumCents: number;
  lotTitle: string;
  lotThumbnail: string | null;
  timeRemaining: number | null;
  onClose: () => void;
  onSubmit: (amountCents: number) => Promise<void> | void;
}

export function CustomBidModal({
  isOpen,
  minimumCents,
  lotTitle,
  lotThumbnail,
  timeRemaining,
  onClose,
  onSubmit,
}: CustomBidModalProps) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRaw(centsToDollarsString(minimumCents));
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, minimumCents]);

  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = dollarsInputToCents(raw);
    if (cents == null) {
      setError("Enter a valid amount");
      return;
    }
    if (cents < minimumCents) {
      setError(`Minimum bid is ${formatMoney(minimumCents)}`);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(cents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      label="CUSTOM BID"
      title={`Bid ${formatMoney(minimumCents)} or higher`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[#5e5e5e]" style={fontDisplay}>
          Once bid is placed, you will be the highest bidder
        </p>

        <div className="flex items-center gap-3 rounded-md bg-[#f8f8f8] p-2">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-[#f3f3f3]">
            {lotThumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lotThumbnail} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <span
            className="flex-1 truncate text-xs uppercase tracking-[-0.02em] text-black"
            style={fontMono}
          >
            {lotTitle}
          </span>
          <LiveCountdown timeRemaining={timeRemaining} />
        </div>

        <div className="relative">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#9c9c9c]"
            style={fontDisplay}
          >
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setError(null);
            }}
            className="h-[50px] w-full rounded border border-[#bababa] bg-white pl-7 pr-4 text-sm text-black outline-none focus:border-black"
            style={fontDisplay}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-xs text-[#dc2626]" style={fontMono}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-[50px] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={fontMono}
        >
          {submitting ? "PLACING…" : "PLACE BID"}
        </button>
      </form>
    </ModalOverlay>
  );
}
