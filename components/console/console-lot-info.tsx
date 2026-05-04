import type { LiveLot } from "@/lib/live-auction-data";
import { formatEstimate, formatMoney, pad } from "@/lib/format";
import { LiveLotMetadata } from "@/components/live/live-lot-metadata";

interface ConsoleLotInfoProps {
  lot: LiveLot;
  lotIndex: number;
  totalLots: number;
  reserveMet: boolean;
}

export function ConsoleLotInfo({
  lot,
  lotIndex,
  totalLots,
  reserveMet,
}: ConsoleLotInfoProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };
  const brand = lot.tags.length > 0 ? lot.tags[0] : null;

  return (
    <div className="flex flex-col gap-3">
      <span
        className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
        style={fontMono}
      >
        LOT {pad(lotIndex + 1)} OF {pad(totalLots)}
      </span>
      <h1
        className="text-2xl leading-[1.1] tracking-[-0.02em] text-black"
        style={fontDisplay}
      >
        {lot.title}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {brand && (
          <span
            className="rounded-full bg-[#f3f3f3] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-black"
            style={fontMono}
          >
            {brand}
          </span>
        )}
        {lot.reserve != null && lot.reserve > 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest ${
              reserveMet
                ? "bg-[#10b981] text-white"
                : "bg-[#f3f3f3] text-[#5e5e5e]"
            }`}
            style={fontMono}
          >
            {reserveMet ? "RESERVE MET ✓" : "RESERVE"}
          </span>
        )}
        <span
          className="rounded-full bg-[#f3f3f3] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-black"
          style={fontMono}
        >
          EST: {formatEstimate(lot.estimate_low, lot.estimate_high)}
        </span>
        <span
          className="rounded-full bg-[#f3f3f3] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-black"
          style={fontMono}
        >
          STARTS: {formatMoney(lot.starting_bid)}
        </span>
      </div>

      {lot.description && (
        <div>
          <span
            className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
            style={fontMono}
          >
            DESCRIPTION
          </span>
          <p
            className="mt-1 text-sm leading-relaxed text-[#2a2a2a]"
            style={fontDisplay}
          >
            {lot.description}
          </p>
        </div>
      )}
      {lot.condition_report && (
        <div>
          <span
            className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
            style={fontMono}
          >
            CONDITION REPORT
          </span>
          <p
            className="mt-1 text-sm leading-relaxed text-[#2a2a2a]"
            style={fontDisplay}
          >
            {lot.condition_report}
          </p>
        </div>
      )}
      {lot.measurements && (
        <div>
          <span
            className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
            style={fontMono}
          >
            MEASUREMENTS
          </span>
          <pre
            className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#2a2a2a]"
            style={fontDisplay}
          >
            {lot.measurements}
          </pre>
        </div>
      )}

      <LiveLotMetadata lot={lot} />
    </div>
  );
}
