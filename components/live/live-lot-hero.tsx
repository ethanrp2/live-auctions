"use client";

import { ImageCarousel } from "@/components/storefront/image-carousel";

export interface LiveLotHeroProps {
  images: string[];
  title: string;
  onAskQuestion?: () => void;
}

function QuestionIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className="h-3 w-3 shrink-0"
      aria-hidden="true"
    >
      <circle
        cx="6"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M4.75 4.5a1.25 1.25 0 1 1 1.75 1.15c-.4.18-.5.5-.5.85V7"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="6" cy="8.75" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function LiveLotHero({ images, title, onAskQuestion }: LiveLotHeroProps) {
  const disabled = onAskQuestion === undefined;
  return (
    <div className="relative w-full">
      <ImageCarousel images={images} alt={title} heightClass="h-60" />
      <button
        type="button"
        onClick={disabled ? undefined : onAskQuestion}
        disabled={disabled}
        className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-[4px] bg-black/40 px-2 py-1 text-white ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
        style={{ fontFamily: "var(--storefront-font-mono)" }}
        aria-label="Ask a question"
      >
        <QuestionIcon />
        <span className="text-xs uppercase tracking-[-0.02em]">
          Ask a question
        </span>
      </button>
    </div>
  );
}
