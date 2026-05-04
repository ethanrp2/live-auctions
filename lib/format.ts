/**
 * Shared formatting utilities for storefront components.
 *
 * Money convention: all integer amounts in the DB and in Basta are CENTS.
 * `formatMoney` and `formatEstimate` take cents and render dollars.
 */

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatMoney(cents: number | null): string {
  if (cents == null) return "\u2014";
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEstimate(
  lowCents: number | null,
  highCents: number | null
): string {
  if (lowCents == null && highCents == null) return "\u2014";
  if (lowCents != null && highCents != null && lowCents === highCents) {
    return formatMoney(lowCents);
  }
  if (lowCents != null && highCents != null) {
    return `${formatMoney(lowCents)} \u2013 ${formatMoney(highCents)}`;
  }
  return formatMoney(lowCents ?? highCents);
}

export function dollarsInputToCents(input: string): number | null {
  const cleaned = input.replace(/[\s,$]/g, "").trim();
  if (!cleaned) return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatLiveDate(iso: string): string {
  const date = new Date(iso);
  const month = date
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase();
  const day = date.getDate();
  const time = date
    .toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
  return `LIVE ${month} ${day} AT ${time}`;
}
