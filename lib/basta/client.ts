const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export type BastaBidType = "MAX" | "NORMAL";

export type BastaBidResult =
  | {
      ok: true;
      amount: number;
      bidStatus: string;
      date: string;
      bidType: BastaBidType;
    }
  | {
      ok: false;
      errorCode: string;
      error: string;
    };

export async function bidOnItem(params: {
  supabaseAccessToken: string;
  saleId: string;
  itemId: string;
  /** Integer cents. */
  amount: number;
  type: BastaBidType;
}): Promise<BastaBidResult> {
  const res = await fetch(`${BACKEND_URL}/api/basta/bid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.supabaseAccessToken}`,
    },
    body: JSON.stringify({
      saleId: params.saleId,
      itemId: params.itemId,
      amountCents: params.amount,
      type: params.type,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Partial<BastaBidResult> & {
    error?: string;
  };

  if (!res.ok || body.ok !== true) {
    return {
      ok: false,
      errorCode: "errorCode" in body && body.errorCode ? body.errorCode : `HTTP_${res.status}`,
      error: body.error ?? "Bid could not be placed.",
    };
  }

  return {
    ok: true,
    amount: body.amount!,
    bidStatus: body.bidStatus!,
    date: body.date!,
    bidType: body.bidType ?? params.type,
  };
}

/**
 * Friendly message per documented Basta error code. Falls back to the raw
 * Basta-provided `error` string.
 *
 * Codes per references/client_api.md:
 *   BID_TOO_LOW | ITEM_CLOSED | INVALID_TOKEN | UNAUTHORIZED
 */
export function bidErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "BID_TOO_LOW":
      return "Your bid is below the next increment.";
    case "ITEM_CLOSED":
      return "This lot is no longer accepting bids.";
    case "INVALID_TOKEN":
    case "UNAUTHORIZED":
      return "Your bidding session expired. Please try again.";
    default:
      return fallback || "Bid could not be placed. Please try again.";
  }
}
