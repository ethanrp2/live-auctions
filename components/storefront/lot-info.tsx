import type { StorefrontAuction, StorefrontLotDetail } from "@/lib/storefront-data";
import {
  getWinnerDisplayLabel,
  getStorefrontAuctionPhase,
  getStorefrontLotOutcome,
} from "@/lib/storefront-state";
import { formatEstimateCents, formatMoneyCents, pad } from "@/lib/format";

interface LotInfoProps {
  lot: StorefrontLotDetail;
  auction?: StorefrontAuction;
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

function buildPills(lot: StorefrontLotDetail, auction: StorefrontAuction): string[] {
  const estimate = formatEstimateCents(lot.estimate_low, lot.estimate_high);
  const phase = getStorefrontAuctionPhase(auction);
  const outcome = getStorefrontLotOutcome(lot, auction);
  const pills: string[] = [...lot.tags];

  if (outcome === "sold") {
    pills.push(`SOLD FOR ${formatMoneyCents(lot.winning_bid_cents)}`);
    pills.push(`WINNER: ${getWinnerDisplayLabel(lot)}`);
    return pills;
  }

  if (outcome === "passed") {
    pills.push("PASSED");
    return pills;
  }

  if (outcome === "ended") {
    pills.push("NO SALE");
    return pills;
  }

  if (lot.starting_bid != null) {
    pills.push(
      phase === "live"
        ? `OPENING ${formatMoneyCents(lot.starting_bid)}`
        : `STARTS: ${formatMoneyCents(lot.starting_bid)}`
    );
  }
  if (estimate !== "\u2014") {
    pills.push(`EST: ${estimate}`);
  }
  return pills;
}

export function LotInfo({ lot, auction, lotIndex, totalLots }: LotInfoProps) {
  const pills = auction
    ? buildPills(lot, auction)
    : [
        ...lot.tags,
        ...(lot.starting_bid != null ? [`STARTS: ${formatMoneyCents(lot.starting_bid)}`] : []),
        ...(formatEstimateCents(lot.estimate_low, lot.estimate_high) !== "\u2014"
          ? [`EST: ${formatEstimateCents(lot.estimate_low, lot.estimate_high)}`]
          : []),
      ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            LOT {pad(lotIndex)} OF {totalLots}
          </span>

          <h1
            className="text-lg font-normal leading-tight text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            {lot.title}
          </h1>
        </div>

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

      <div className="flex flex-col gap-3.5">
        {lot.description && (
          <Section label="Description">
            <p>{lot.description}</p>
          </Section>
        )}

        {lot.condition_report && (
          <Section label="Condition Report">
            <p>{lot.condition_report}</p>
          </Section>
        )}

        {lot.measurements && (
          <Section label="Measurements">
            <p>{lot.measurements}</p>
          </Section>
        )}

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
