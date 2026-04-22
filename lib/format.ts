/**
 * Shared formatting utilities for storefront components.
 *
 * Money convention: ALL money values in this codebase are integer cents.
 * See docs/memory/architecture/money-units.md and
 * docs/memory/decisions/ADR-002-money-in-cents.md.
 *
 * Formatter names explicitly include `Cents` so a typo like
 * `formatMoneyCents(1250)` (= $12.50) is obvious to the reader, instead of
 * silently rendering $1,250 from a value that was supposed to be dollars.
 */

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDollars(dollars: number): string {
  if (Number.isInteger(dollars)) {
    return `$${dollars.toLocaleString("en-US")}`;
  }
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format an integer-cents amount as a dollar string.
 * Whole dollars render with no decimals ($1,250). Fractional renders with two.
 */
export function formatMoneyCents(cents: number | null | undefined): string {
  if (cents == null) return "\u2014";
  return formatDollars(cents / 100);
}

/**
 * Format an estimate range (both values in cents). Accepts either side null.
 */
export function formatEstimateCents(
  lowCents: number | null | undefined,
  highCents: number | null | undefined
): string {
  if (lowCents == null && highCents == null) return "\u2014";
  if (lowCents != null && highCents != null && lowCents === highCents) {
    return formatMoneyCents(lowCents);
  }
  if (lowCents != null && highCents != null) {
    return `${formatMoneyCents(lowCents)} \u2013 ${formatMoneyCents(highCents)}`;
  }
  return formatMoneyCents(lowCents ?? highCents ?? null);
}

/**
 * Parse a user-entered dollar string (`"$1,250"`, `"1250.50"`, etc.) into
 * integer cents. Throws on invalid input; callers should validate.
 */
export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new Error(`Invalid money input: ${JSON.stringify(input)}`);
  }
  return Math.round(dollars * 100);
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
