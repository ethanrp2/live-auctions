"use client";

import { useState } from "react";
import { ModalOverlay } from "./modal-overlay";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 16" fill="none" className="h-4 w-6" aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="15" rx="2" stroke="#BABABA" />
      <rect x="2" y="3" width="6" height="4" rx="0.5" fill="#1A1F71" />
      <rect x="2" y="10" width="20" height="1" fill="#F3F3F3" />
    </svg>
  );
}

export function PaymentModal({ isOpen, onClose, onComplete }: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.trim() && expiry.trim() && cvv.trim()) {
      onComplete();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            REQUIRED
          </span>
          <h2
            className="text-xl font-normal text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            Payment method
          </h2>
        </div>

        {/* Card number */}
        <div className="relative">
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Card number"
            className="h-[50px] w-full rounded border border-[#bababa] bg-white pl-4 pr-12 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <CardIcon />
          </div>
        </div>

        {/* Expiry + CVV */}
        <div className="flex gap-3">
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="MM / YY"
            className="h-[50px] flex-1 rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <input
            type="text"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="CVV"
            className="h-[50px] flex-1 rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
        </div>

        {/* Continue button */}
        <button
          type="submit"
          className="flex h-[50px] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          CONTINUE
        </button>
      </form>
    </ModalOverlay>
  );
}
