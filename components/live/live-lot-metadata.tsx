import type { LiveLot } from "@/lib/live-auction-data";

interface LiveLotMetadataProps {
  lot: LiveLot;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f3f3f3] py-2 text-xs">
      <span
        className="uppercase tracking-[-0.02em] text-[#9c9c9c]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {label}
      </span>
      <span
        className="text-right text-black"
        style={{ fontFamily: "var(--storefront-font-display)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function LiveLotMetadata({ lot }: LiveLotMetadataProps) {
  return (
    <div className="flex flex-col">
      <Row label="YEAR" value={lot.year?.toString() ?? null} />
      <Row label="MEASUREMENTS" value={lot.measurements} />
      <Row label="PROVENANCE" value={lot.provenance} />
      <Row label="LOCATION" value={lot.item_location} />
      <Row label="SHIPPING" value={lot.shipping_terms} />
    </div>
  );
}
