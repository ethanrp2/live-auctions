"use client";

import type { LiveLot } from "@/lib/live-auction-data";
import { ImageCarousel } from "@/components/storefront/image-carousel";

interface LiveLotMediaProps {
  lot: LiveLot;
  onAskQuestion: () => void;
}

export function LiveLotMedia({ lot, onAskQuestion }: LiveLotMediaProps) {
  return (
    <div className="relative h-full w-full bg-[#f8f8f8]">
      <ImageCarousel images={lot.images} alt={lot.title} />
      <button
        type="button"
        onClick={onAskQuestion}
        className="absolute bottom-4 right-4 z-10 rounded-full bg-black/80 px-4 py-2 text-[11px] uppercase tracking-[-0.02em] text-white backdrop-blur transition-colors hover:bg-black"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        Ask a question
      </button>
    </div>
  );
}
