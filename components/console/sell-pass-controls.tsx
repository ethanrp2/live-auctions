"use client";

interface SellPassControlsProps {
  onSell: () => void;
  onPass: () => void;
  onNextLot: () => void;
  disabled?: boolean;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3 8l3.5 3.5L13 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function SellPassControls({
  onSell,
  onPass,
  onNextLot,
  disabled,
}: SellPassControlsProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSell}
          disabled={disabled}
          className="flex h-[50px] items-center justify-center gap-2 rounded-md bg-[#10b981] text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={fontMono}
        >
          <CheckIcon /> SELL
        </button>
        <button
          type="button"
          onClick={onPass}
          disabled={disabled}
          className="flex h-[50px] items-center justify-center rounded-md border border-[#d4d4d4] bg-white text-sm uppercase tracking-[-0.02em] text-black transition-colors hover:bg-[#f8f8f8] disabled:opacity-50"
          style={fontMono}
        >
          PASS — NO SALE
        </button>
      </div>
      <button
        type="button"
        onClick={onNextLot}
        disabled={disabled}
        className="flex h-[50px] items-center justify-center rounded-md bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={fontMono}
      >
        NEXT LOT →
      </button>
    </div>
  );
}
