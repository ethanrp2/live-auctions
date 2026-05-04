import { formatMoney } from "@/lib/format";

export type BannerKind =
  | "winning"
  | "outbid"
  | "sold-to-other"
  | "won"
  | "passed";

interface MyBidBannerProps {
  kind: BannerKind;
  myBidAmountCents: number | null;
  winnerHandle: string | null;
}

const STYLE: Record<BannerKind, string> = {
  winning: "bg-[#10b981] text-white",
  outbid: "bg-[#dc2626] text-white",
  "sold-to-other": "bg-[#f3f3f3] text-black",
  won: "bg-[#10b981] text-white",
  passed: "bg-[#f3f3f3] text-black",
};

export function MyBidBanner({
  kind,
  myBidAmountCents,
  winnerHandle,
}: MyBidBannerProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };

  let primary = "";
  let secondary: string | null = null;

  switch (kind) {
    case "winning":
      primary = "YOU'RE THE HIGHEST BIDDER";
      secondary = myBidAmountCents != null
        ? `YOUR BID: ${formatMoney(myBidAmountCents)}`
        : null;
      break;
    case "outbid":
      primary = "YOU'RE OUTBID";
      secondary = myBidAmountCents != null
        ? `YOUR BID: ${formatMoney(myBidAmountCents)}`
        : null;
      break;
    case "sold-to-other":
      primary = winnerHandle ? `SOLD TO @${winnerHandle}` : "SOLD";
      break;
    case "won":
      primary = "YOU WON";
      secondary = "VIEW ORDER →";
      break;
    case "passed":
      primary = "PASSED";
      break;
  }

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-xs uppercase tracking-[-0.02em] ${STYLE[kind]}`}
      style={fontMono}
    >
      <span className="font-semibold">{primary}</span>
      {secondary &&
        (kind === "won" ? (
          <a
            href="/orders"
            className="font-semibold underline-offset-2 hover:underline"
          >
            {secondary}
          </a>
        ) : (
          <span>{secondary}</span>
        ))}
    </div>
  );
}
