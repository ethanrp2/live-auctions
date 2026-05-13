import type { StorefrontAuction, StorefrontLot } from "@/lib/storefront-data";
import { LotCard } from "./lot-card";

interface LotGridProps {
  auction: StorefrontAuction;
  lots: StorefrontLot[];
}

export function LotGrid({ auction, lots }: LotGridProps) {
  if (lots.length === 0) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center p-6 text-sm uppercase tracking-widest text-[#5e5e5e]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        No lots yet — check back soon.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 p-5 pb-40 sm:grid-cols-2 lg:grid-cols-3 lg:items-start lg:pb-5">
      {lots.map((lot, index) => (
        <LotCard key={lot.id} auction={auction} lot={lot} index={index} total={lots.length} />
      ))}
    </div>
  );
}
