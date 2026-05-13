"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BastaLogo } from "@/components/storefront/basta-logo";

export interface LiveTopBarProps {
  tenantName: string;
  tenantLogoUrl: string | null;
  accountLabel: string;
  accountShortLabel: string;
  onAccount: () => void;
  audioSlot?: ReactNode;
}

export function LiveTopBar({
  tenantName,
  tenantLogoUrl,
  accountLabel,
  accountShortLabel,
  onAccount,
  audioSlot,
}: LiveTopBarProps) {
  return (
    <div
      className="relative flex h-11 w-full shrink-0 items-center justify-between px-4 py-3"
      style={{ backgroundColor: "var(--storefront-primary)" }}
    >
      <Link
        href="/"
        className="flex min-w-0 flex-1 items-center gap-2 pr-20 transition-opacity hover:opacity-80"
        aria-label={`Go to ${tenantName} homepage`}
      >
        {tenantLogoUrl ? (
          <div
            className="h-[18px] w-[18px] shrink-0 overflow-hidden rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--storefront-badge-text) 10%, transparent)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tenantLogoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <span
          className="min-w-0 truncate text-xs uppercase tracking-[-0.02em]"
          style={{
            fontFamily: "var(--storefront-font-mono)",
            color: "var(--storefront-badge-text)",
          }}
        >
          {tenantName.toUpperCase()}
        </span>
      </Link>

      <Link
        href="/"
        className="absolute left-1/2 hidden -translate-x-1/2 transition-opacity hover:opacity-80 md:block"
        style={{ color: "var(--storefront-badge-text)" }}
        aria-label={`Go to ${tenantName} homepage`}
      >
        <BastaLogo className="h-3 w-[45px]" />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        {audioSlot ? <div className="flex shrink-0 items-center">{audioSlot}</div> : null}
        <button
          type="button"
          onClick={onAccount}
          className="flex h-[26px] items-center rounded-[6px] px-2 text-xs uppercase tracking-[-0.02em] transition-all"
          style={{
            fontFamily: "var(--storefront-font-mono)",
            color: "var(--storefront-badge-text)",
            border: "1px solid var(--storefront-badge-text)",
          }}
          aria-label={accountLabel}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--storefront-badge-text)";
            e.currentTarget.style.color = "var(--storefront-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--storefront-badge-text)";
          }}
        >
          <span className="sm:hidden">{accountShortLabel}</span>
          <span className="hidden sm:inline">{accountLabel}</span>
        </button>
      </div>
    </div>
  );
}
