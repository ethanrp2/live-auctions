"use client";

import { useState } from "react";
import { ModalOverlay } from "@/components/storefront/modal-overlay";

interface ConfirmActionModalProps {
  isOpen: boolean;
  label: string;
  title: string;
  helper: string;
  confirmLabel: string;
  confirmVariant?: "default" | "danger";
  lotTitle?: string;
  lotThumbnail?: string | null;
  lotNumber?: number;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmActionModal({
  isOpen,
  label,
  title,
  helper,
  confirmLabel,
  confirmVariant = "default",
  lotTitle,
  lotThumbnail,
  lotNumber,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      label={label}
      title={title}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#5e5e5e]" style={fontDisplay}>
          {helper}
        </p>

        {lotTitle && (
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
              {lotNumber != null ? `LOT ${String(lotNumber).padStart(2, "0")}: ` : ""}
              {lotTitle}
            </span>
          </div>
        )}

        {error && (
          <p className="text-xs text-[#dc2626]" style={fontMono}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-[50px] flex-1 items-center justify-center rounded-md border border-[#d4d4d4] bg-white text-sm uppercase tracking-[-0.02em] text-black transition-colors hover:bg-[#f8f8f8] disabled:opacity-50"
            style={fontMono}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex h-[50px] flex-1 items-center justify-center rounded-md text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
              confirmVariant === "danger" ? "bg-[#dc2626]" : "bg-black"
            }`}
            style={fontMono}
          >
            {submitting ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
