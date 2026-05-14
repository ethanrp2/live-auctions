"use client";

import { useEffect } from "react";
import { MaxBidSection } from "@/components/storefront/max-bid-section";

export interface MaxBidSheetProps {
  isOpen: boolean;
  onClose: () => void;
  lotId: string;
  /** Integer cents. See docs/memory/architecture/money-units.md. */
  startingBidCents: number | null;
  isAuthenticated: boolean;
  onAuthRequired?: () => void;
}

export function MaxBidSheet({
  isOpen,
  onClose,
  lotId,
  startingBidCents,
  isAuthenticated,
  onAuthRequired,
}: MaxBidSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-xl flex-col gap-4 rounded-t-[4px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[-0.02em] text-black">
              SET MAX BID
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#9c9c9c]">
              [ESC]
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] hover:text-black"
            >
              CLOSE
            </button>
          </div>
        </div>

        <MaxBidSection
          lotId={lotId}
          startingBid={startingBidCents}
          isAuthenticated={isAuthenticated}
          onAuthRequired={onAuthRequired}
        />
      </div>
    </div>
  );
}
