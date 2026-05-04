"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "default" | "sheet";
  label?: string;
  title?: string;
}

export function ModalOverlay({
  isOpen,
  onClose,
  children,
  variant = "default",
  label,
  title,
}: ModalOverlayProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const isSheet = variant === "sheet";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-backdrop-enter absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full lg:max-w-[460px]">
        <div
          className={`${isSheet ? "sheet-enter max-h-[85vh] overflow-hidden rounded-t-2xl bg-white lg:max-h-none lg:rounded-md" : "rounded-t-xl bg-white lg:rounded-md"}`}
        >
          {isSheet ? (
            <div className="flex flex-col">
              <div className="relative flex items-start justify-between gap-3 px-5 pt-5 lg:px-[30px] lg:pt-[30px]">
                <div className="flex flex-col gap-1">
                  {label && (
                    <span
                      className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
                      style={{ fontFamily: "var(--storefront-font-mono)" }}
                    >
                      {label}
                    </span>
                  )}
                  {title && (
                    <h2
                      className="text-xl leading-tight tracking-[-0.02em] text-black lg:text-2xl"
                      style={{ fontFamily: "var(--storefront-font-display)" }}
                    >
                      {title}
                    </h2>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#5e5e5e] transition-colors hover:bg-[#f3f3f3] hover:text-black"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-5 pt-4 lg:px-[30px] lg:pb-[30px]">
                {children}
              </div>
            </div>
          ) : (
            <div className="p-6 lg:p-[30px]">{children}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
