/**
 * Basta Client API wrapper — client-side only.
 *
 * All calls here go directly to wss/https://client.api.basta.app from the
 * browser. Mutations (bidOnItem) require a bidder JWT from our Fastify
 * /api/basta-token endpoint via lib/basta-token.ts.
 *
 * See docs/memory/architecture/basta-integration.md for the full bid flow.
 */

const BASTA_CLIENT_URL =
  process.env.NEXT_PUBLIC_BASTA_CLIENT_URL ??
  "https://client.api.basta.app/graphql";

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

interface GraphQLError {
  message: string;
  extensions?: Record<string, unknown>;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

// Union types come back with __typename discriminators.
interface BidOnItemResponse {
  bidOnItem:
    | {
        __typename: "BidPlacedSuccess";
        amount: number;
        bidStatus: string;
        date: string;
      }
    | {
        __typename: "BidPlacedError";
        errorCode: string;
        error: string;
      };
}

const BID_ON_ITEM = /* GraphQL */ `
  mutation BidOnItem(
    $saleId: String!
    $itemId: String!
    $amount: Int!
    $type: BidType!
  ) {
    bidOnItem(saleId: $saleId, itemId: $itemId, amount: $amount, type: $type) {
      __typename
      ... on BidPlacedSuccess {
        amount
        bidStatus
        date
      }
      ... on BidPlacedError {
        errorCode
        error
      }
    }
  }
`;

export async function bidOnItem(params: {
  bidderToken: string;
  saleId: string;
  itemId: string;
  /** Integer cents. */
  amount: number;
  type: BastaBidType;
}): Promise<BastaBidResult> {
  const res = await fetch(BASTA_CLIENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.bidderToken}`,
    },
    body: JSON.stringify({
      query: BID_ON_ITEM,
      variables: {
        saleId: params.saleId,
        itemId: params.itemId,
        amount: params.amount,
        type: params.type,
      },
    }),
  });

  if (!res.ok) {
    // Transport-level failure (5xx, network, CORS). Surface as an error-shaped
    // result so the caller only ever has two branches to handle.
    return {
      ok: false,
      errorCode: `HTTP_${res.status}`,
      error: `Basta Client API returned ${res.status}`,
    };
  }

  const body = (await res.json()) as GraphQLResponse<BidOnItemResponse>;

  if (body.errors && body.errors.length > 0) {
    return {
      ok: false,
      errorCode: "GRAPHQL_ERROR",
      error: body.errors.map((e) => e.message).join("; "),
    };
  }

  const payload = body.data?.bidOnItem;
  if (!payload) {
    return {
      ok: false,
      errorCode: "EMPTY_RESPONSE",
      error: "Basta returned no bidOnItem payload",
    };
  }

  if (payload.__typename === "BidPlacedSuccess") {
    return {
      ok: true,
      amount: payload.amount,
      bidStatus: payload.bidStatus,
      date: payload.date,
      bidType: params.type,
    };
  }

  return {
    ok: false,
    errorCode: payload.errorCode,
    error: payload.error,
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
