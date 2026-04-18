import type { StorefrontLotDetail } from "@/lib/storefront-data";
import { formatEstimate, formatMoney, pad } from "@/lib/format";

interface LotInfoProps {
  lot: StorefrontLotDetail;
  lotIndex: number;
  totalLots: number;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[11px] uppercase text-[#5e5e5e]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {label}
      </span>
      <div
        className="text-xs leading-relaxed text-black"
        style={{ fontFamily: "var(--storefront-font-display)" }}
      >
        {children}
      </div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className="shrink-0 text-[11px] uppercase text-[#5e5e5e]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {label}
      </span>
      <span
        className="text-right text-[11px] uppercase text-black"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function LotInfo({ lot, lotIndex, totalLots }: LotInfoProps) {
  const estimate = formatEstimate(lot.estimate_low, lot.estimate_high);

  // Build tag pills: brand tags + starts + estimate
  const pills: string[] = [...lot.tags];
  if (lot.starting_bid != null) {
    pills.push(`STARTS: ${formatMoney(lot.starting_bid)}`);
  }
  if (estimate !== "\u2014") {
    pills.push(`EST: ${estimate}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title block: lot number, title, tags */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          {/* Lot number */}
          <span
            className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            LOT {pad(lotIndex)} OF {totalLots}
          </span>

          {/* Title */}
          <h1
            className="text-lg font-normal leading-tight text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            {lot.title}
          </h1>
        </div>

        {/* Tag pills (brand + starts + estimate) */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pills.map((tag) => (
              <span
                key={tag}
                className="rounded-[4px] bg-[#ededed] px-1.5 py-0.5 text-[11px] text-black"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Details block: description, condition, measurements, metadata */}
      <div className="flex flex-col gap-3.5">
        {/* Description */}
        {lot.description && (
          <Section label="Description">
            <p>{lot.description}</p>
          </Section>
        )}

        {/* Condition Report */}
        {lot.condition_report && (
          <Section label="Condition Report">
            <p>{lot.condition_report}</p>
          </Section>
        )}

        {/* Measurements */}
        {lot.measurements && (
          <Section label="Measurements">
            <p>{lot.measurements}</p>
          </Section>
        )}

        {/* Metadata rows — 8px gap */}
        <div className="flex flex-col gap-2">
          {lot.year && <MetadataRow label="Year" value={String(lot.year)} />}
          {lot.provenance && <MetadataRow label="Provenance" value={lot.provenance} />}
          {lot.item_location && <MetadataRow label="Item Location" value={lot.item_location} />}
          {lot.shipping_terms && <MetadataRow label="Shipping" value={lot.shipping_terms} />}
        </div>
      </div>

    </div>
  );
}
