"use client";

import { useState } from "react";
import { isLightColor } from "@/lib/color";
import { ModalOverlay } from "./modal-overlay";

interface SmsSubscribeSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function CheckIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 11 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-2 w-[11px]"
      style={style}
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

function UsFlagIcon() {
  return (
    <svg
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[14px] w-5"
      aria-hidden="true"
    >
      <rect width="20" height="14" rx="1" fill="#FFFFFF" />
      <rect y="0" width="20" height="1" fill="#B22234" />
      <rect y="2" width="20" height="1" fill="#B22234" />
      <rect y="4" width="20" height="1" fill="#B22234" />
      <rect y="6" width="20" height="1" fill="#B22234" />
      <rect y="8" width="20" height="1" fill="#B22234" />
      <rect y="10" width="20" height="1" fill="#B22234" />
      <rect y="12" width="20" height="1" fill="#B22234" />
      <rect width="8" height="7" fill="#3C3B6E" />
    </svg>
  );
}

export function SmsSubscribeSheet({ isOpen, onClose }: SmsSubscribeSheetProps) {
  const [phone, setPhone] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Read primary color from CSS variable at render time
  const primaryColor =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--storefront-primary").trim() || "#000000"
      : "#000000";
  const buttonTextColor = isLightColor(primaryColor) ? "#000000" : "#ffffff";

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <p
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            {subscribed ? "YOU'RE ON THE LIST" : "SUBSCRIBE TO GET ALERTS"}
          </p>
          <p
            className="text-xl leading-tight text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            {subscribed
              ? "We'll text you before it starts"
              : "Get text alerts for this auction"}
          </p>
        </div>

        {subscribed ? (
          <div
            className="flex h-[50px] items-center justify-center gap-2.5 rounded"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckIcon style={{ color: buttonTextColor }} />
            <span
              className="text-sm uppercase tracking-[-0.02em]"
              style={{
                fontFamily: "var(--storefront-font-mono)",
                color: buttonTextColor,
              }}
            >
              SUBSCRIBED
            </span>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (phone.trim().length >= 7) setSubscribed(true);
            }}
            className="flex items-center justify-between rounded bg-[#f3f3f3] py-[5px] pl-4 pr-[5px]"
          >
            <div className="flex flex-1 items-center gap-3">
              <UsFlagIcon />
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(000) 000-000"
                className="w-full bg-transparent text-sm text-[#5e5e5e] outline-none placeholder:text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-display)" }}
              />
            </div>
            <button
              type="submit"
              className="flex h-10 shrink-0 items-center rounded px-5 text-sm uppercase tracking-[-0.02em] transition hover:opacity-90"
              style={{
                fontFamily: "var(--storefront-font-mono)",
                backgroundColor: primaryColor,
                color: buttonTextColor,
              }}
            >
              SUBSCRIBE
            </button>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}
