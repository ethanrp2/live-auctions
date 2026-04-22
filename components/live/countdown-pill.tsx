"use client";

import { formatCountdown } from "@/lib/hooks/use-countdown";

interface CountdownPillProps {
  countdownMs: number | null;
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 4.5V8L10.25 9.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CountdownPill({ countdownMs }: CountdownPillProps) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-[6px] bg-[#ededed] px-2 py-1 text-black"
      style={{ fontFamily: "var(--storefront-font-mono)" }}
    >
      <ClockIcon />
      <span className="text-base leading-none tracking-[-0.02em]">
        {formatCountdown(countdownMs)}
      </span>
    </div>
  );
}
