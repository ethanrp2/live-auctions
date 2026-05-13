/**
 * Fetch Basta bid-support data (saleId + itemId + increment table) for a lot,
 * via our Fastify backend. No auth required — the data is public.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function backendUnavailableMessage(): string {
  return `Can't reach the API backend at ${BACKEND_URL}. Run \`pnpm dev:all\` so Fastify starts alongside Next.`;
}

export interface BidIncrementRule {
  lowRange: number;
  highRange: number;
  step: number;
}

export interface BidSupport {
  saleId: string;
  itemId: string;
  allowedBidTypes: readonly ("MAX" | "NORMAL")[];
  bidIncrementTable: BidIncrementRule[] | null;
  closingTimeCountdownMs: number | null;
  startingBidCents: number;
  auctionStatus: string | null;
}

export async function fetchBidSupport(lotId: string): Promise<BidSupport> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/basta/bid-support/${lotId}`, {
      method: "GET",
    });
  } catch {
    throw new Error(backendUnavailableMessage());
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `bid-support failed (${res.status})`);
  }

  return (await res.json()) as BidSupport;
}

/**
 * Given the current price in cents and an increment table, return the step
 * that applies. Returns `null` if no rule matches (caller should fall back to
 * the last known step or refuse to bid).
 */
export function resolveIncrement(
  currentCents: number,
  rules: BidIncrementRule[] | null
): number | null {
  if (!rules || rules.length === 0) return null;
  for (const rule of rules) {
    if (currentCents >= rule.lowRange && currentCents < rule.highRange) {
      return rule.step;
    }
  }
  // Currency above the top of the table → use the highest rule's step.
  const last = rules[rules.length - 1];
  return last?.step ?? null;
}
