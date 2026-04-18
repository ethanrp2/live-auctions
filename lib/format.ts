/**
 * Shared formatting utilities for storefront components.
 */

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatMoney(value: number | null): string {
  if (value == null) return "\u2014";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatEstimate(low: number | null, high: number | null): string {
  if (low == null && high == null) return "\u2014";
  if (low != null && high != null && low === high) {
    return `${formatMoney(low)}.00`;
  }
  if (low != null && high != null) {
    return `${formatMoney(low)} \u2013 ${formatMoney(high)}`;
  }
  return `${formatMoney(low ?? high)}.00`;
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
