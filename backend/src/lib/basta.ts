import { GraphQLClient, gql } from "graphql-request";
import { config } from "../config.js";

const client = new GraphQLClient(config.bastaManagementUrl, {
  headers: {
    "x-account-id": config.bastaAccountId,
    "x-api-key": config.bastaApiKey,
  },
});

const CREATE_BIDDER_TOKEN = gql`
  mutation CreateBidderToken($accountID: String!, $userId: String!, $ttl: Int!) {
    createBidderToken(
      accountId: $accountID
      input: { metadata: { userId: $userId, ttl: $ttl } }
    ) {
      token
      expiration
    }
  }
`;

const CREATE_SALE = gql`
  mutation CreateSale($accountID: String!, $input: CreateSaleInput!) {
    createSale(accountId: $accountID, input: $input) {
      id
      status
    }
  }
`;

const CREATE_ITEM_FOR_SALE = gql`
  mutation CreateItemForSale($accountID: String!, $input: SaleItemInput!) {
    createItemForSale(accountId: $accountID, input: $input) {
      id
      status
    }
  }
`;

const PUBLISH_SALE = gql`
  mutation PublishSale($accountID: String!, $input: PublishSaleInput!) {
    publishSale(accountId: $accountID, input: $input) {
      id
      status
    }
  }
`;

interface CreateBidderTokenResponse {
  createBidderToken: {
    token: string;
    expiration: string;
  };
}

interface SaleMutationResponse {
  id: string;
  status: string;
}

interface CreateSaleResponse {
  createSale: SaleMutationResponse;
}

interface CreateItemForSaleResponse {
  createItemForSale: SaleMutationResponse;
}

interface PublishSaleResponse {
  publishSale: SaleMutationResponse;
}

type ClientBidResult =
  | {
      ok: true;
      amount: number | null;
      bidStatus: string;
      date: string;
    }
  | {
      ok: false;
      errorCode: string;
      error: string;
    };

export interface BidIncrementRule {
  lowRange: number;
  highRange: number;
  step: number;
}

export interface CreateSaleInput {
  title: string;
  description: string;
  currency?: string;
  closingMethod?: "OVERLAPPING";
  closingTimeCountdown: number;
  bidIncrementTable: BidIncrementRule[];
}

export type BastaBidType = "MAX" | "NORMAL";

export interface CreateItemForSaleInput {
  saleId: string;
  title: string;
  description: string;
  startingBid: number;
  reserve: number;
  openDate: string;
  closingDate: string;
  /** Which bid types buyers may place on this item. Defaults to [MAX, NORMAL]. */
  allowedBidTypes?: BastaBidType[];
}

export async function createBidderToken(userId: string, ttlMinutes: number) {
  const data = await client.request<CreateBidderTokenResponse>(CREATE_BIDDER_TOKEN, {
    accountID: config.bastaAccountId,
    userId,
    ttl: ttlMinutes,
  });

  return data.createBidderToken;
}

export async function createSale(input: CreateSaleInput) {
  const data = await client.request<CreateSaleResponse>(CREATE_SALE, {
    accountID: config.bastaAccountId,
    input: {
      title: input.title,
      description: input.description,
      currency: input.currency ?? "USD",
      closingMethod: input.closingMethod ?? "OVERLAPPING",
      closingTimeCountdown: input.closingTimeCountdown,
      bidIncrementTable: {
        rules: input.bidIncrementTable,
      },
    },
  });

  return data.createSale;
}

export async function createItemForSale(input: CreateItemForSaleInput) {
  const data = await client.request<CreateItemForSaleResponse>(CREATE_ITEM_FOR_SALE, {
    accountID: config.bastaAccountId,
    input: {
      saleId: input.saleId,
      title: input.title,
      description: input.description,
      startingBid: input.startingBid,
      reserve: input.reserve,
      openDate: input.openDate,
      closingDate: input.closingDate,
      allowedBidTypes: input.allowedBidTypes ?? ["MAX", "NORMAL"],
    },
  });

  return data.createItemForSale;
}

export async function publishSale(saleId: string) {
  const data = await client.request<PublishSaleResponse>(PUBLISH_SALE, {
    accountID: config.bastaAccountId,
    input: { saleId },
  });

  return data.publishSale;
}

export async function bidOnItemWithToken(params: {
  bidderToken: string;
  saleId: string;
  itemId: string;
  amount: number;
  type: BastaBidType;
}): Promise<ClientBidResult> {
  const response = await fetch("https://client.api.basta.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.bidderToken}`,
    },
    body: JSON.stringify({
      query: `
        mutation BidOnItem($saleId: String!, $itemId: String!, $amount: Int!, $type: BidType!) {
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
      `,
      variables: {
        saleId: params.saleId,
        itemId: params.itemId,
        amount: params.amount,
        type: params.type,
      },
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      errorCode: `HTTP_${response.status}`,
      error: `Basta Client API returned ${response.status}`,
    };
  }

  const body = (await response.json()) as {
    data?: {
      bidOnItem?:
        | {
            __typename: "BidPlacedSuccess";
            amount?: number | null;
            bidStatus?: string | null;
            date?: string | null;
          }
        | {
            __typename: "BidPlacedError";
            errorCode: string;
            error: string;
          };
    };
    errors?: { message: string }[];
  };

  if (body.errors?.length) {
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

  if (payload.__typename === "BidPlacedError") {
    return {
      ok: false,
      errorCode: payload.errorCode,
      error: payload.error,
    };
  }

  return {
    ok: true,
    amount: typeof payload.amount === "number" ? payload.amount : null,
    bidStatus: payload.bidStatus ?? "PLACED",
    date: payload.date ?? new Date().toISOString(),
  };
}
