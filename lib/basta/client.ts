const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function backendUnavailableResult(): BastaBidResult {
  return {
    ok: false,
    errorCode: "BACKEND_UNAVAILABLE",
    error: `Can't reach the API backend at ${BACKEND_URL}. Run \`pnpm dev:all\` so Fastify starts alongside Next.`,
  };
}

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

function isClosedStateMessage(message: string): boolean {
  return (
    message.includes("sale state CLOSED") ||
    message.includes("ITEM_CLOSED") ||
    message.includes("item closed")
  );
}

function isNotOpenStateMessage(message: string): boolean {
  return (
    message.includes("ITEM_NOT_OPEN") ||
    message.includes("item in status: ITEM_NOT_OPEN") ||
    message.includes("not allowed for item in status")
  );
}

export async function bidOnItem(params: {
  supabaseAccessToken: string;
  saleId: string;
  itemId: string;
  /** Integer cents. */
  amount: number;
  type: BastaBidType;
}): Promise<BastaBidResult> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/basta/bid`, {
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
  } catch {
    return backendUnavailableResult();
  }

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
  if (isClosedStateMessage(fallback)) {
    return "This lot is no longer accepting bids.";
  }
  if (isNotOpenStateMessage(fallback)) {
    return "This lot is not open in Basta yet. Republish the auction so live lots are open for bidding.";
  }

  switch (code) {
    case "BID_TOO_LOW":
      return "Your bid is below the next increment.";
    case "ITEM_CLOSED":
      return "This lot is no longer accepting bids.";
    case "INVALID_TOKEN":
    case "UNAUTHORIZED":
      return "Your bidding session expired. Please try again.";
    case "BACKEND_UNAVAILABLE":
      return fallback;
    default:
      return fallback || "Bid could not be placed. Please try again.";
  }
}
