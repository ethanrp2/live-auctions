import type { LiveLot } from "@/lib/live-auction-data";
import { formatEstimate, formatMoney, pad } from "@/lib/format";
import { LiveLotMetadata } from "./live-lot-metadata";

interface LiveLotInfoProps {
  lot: LiveLot;
  lotIndex: number;
  totalLots: number;
  reserveMet: boolean;
}

export function LiveLotInfo({
  lot,
  lotIndex,
  totalLots,
  reserveMet,
}: LiveLotInfoProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };
  const brand = lot.tags.length > 0 ? lot.tags[0] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          LOT {pad(lotIndex + 1)} / {pad(totalLots)}
        </span>
        <div className="flex items-center gap-1.5">
          {brand && (
            <span
              className="rounded-full bg-[var(--storefront-primary)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--storefront-badge-text,white)]"
              style={fontMono}
            >
              {brand}
            </span>
          )}
          {lot.reserve != null && lot.reserve > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${
                reserveMet
                  ? "bg-[#10b981] text-white"
                  : "bg-[#f3f3f3] text-[#5e5e5e]"
              }`}
              style={fontMono}
            >
              {reserveMet ? "RESERVE MET" : "RESERVE"}
            </span>
          )}
        </div>
      </div>

      <h1
        className="text-2xl leading-[1.1] tracking-[-0.02em] text-black"
        style={fontDisplay}
      >
        {lot.title}
      </h1>

      <div className="flex items-center gap-4 text-xs" style={fontMono}>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-[#9c9c9c]">
            ESTIMATE
          </span>
          <span className="text-sm text-black">
            {formatEstimate(lot.estimate_low, lot.estimate_high)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-[#9c9c9c]">
            STARTING BID
          </span>
          <span className="text-sm text-black">
            {formatMoney(lot.starting_bid)}
          </span>
        </div>
      </div>

      {lot.description && (
        <p
          className="text-sm leading-relaxed text-[#2a2a2a]"
          style={fontDisplay}
        >
          {lot.description}
        </p>
      )}

      {lot.condition_report && (
        <div>
          <span
            className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
            style={fontMono}
          >
            CONDITION
          </span>
          <p
            className="mt-1 text-sm leading-relaxed text-[#2a2a2a]"
            style={fontDisplay}
          >
            {lot.condition_report}
          </p>
        </div>
      )}

      <LiveLotMetadata lot={lot} />
    </div>
  );
}
