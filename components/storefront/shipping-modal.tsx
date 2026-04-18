"use client";

import { useState } from "react";
import { ModalOverlay } from "./modal-overlay";

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onBack: () => void;
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ShippingModal({ isOpen, onClose, onComplete, onBack }: ShippingModalProps) {
  const [street, setStreet] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (street.trim() && city.trim() && state.trim() && zip.trim()) {
      onComplete();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Close button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-[#5e5e5e] transition-colors hover:text-black"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            SHIPPING
          </span>
          <h2
            className="text-xl font-normal text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            Shipping address
          </h2>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Street address"
            className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <input
            type="text"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="Address line 2"
            className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <div className="flex gap-3">
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              className="h-[50px] flex-1 rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            />
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Zip code"
              className="h-[50px] flex-1 rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-[50px] flex-1 items-center justify-center rounded border border-black text-sm uppercase tracking-[-0.02em] text-black transition-colors hover:bg-[#f8f8f8]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            BACK
          </button>
          <button
            type="submit"
            className="flex h-[50px] flex-1 items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            SAVE AND FINISH
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
