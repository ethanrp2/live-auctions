"use client";

import { formatMoney } from "@/lib/format";

interface BidIncrementsSelectorProps {
  options: number[];
  selected: number;
  onChange: (amountCents: number) => void;
}

export function BidIncrementsSelector({
  options,
  selected,
  onChange,
}: BidIncrementsSelectorProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((amount) => {
        const isActive = amount === selected;
        return (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(amount)}
            className={`h-10 rounded-md text-xs uppercase tracking-[-0.02em] transition-colors ${
              isActive
                ? "bg-black text-white"
                : "bg-[#f3f3f3] text-black hover:bg-[#e8e8e8]"
            }`}
            style={fontMono}
          >
            {formatMoney(amount)}
          </button>
        );
      })}
    </div>
  );
}
