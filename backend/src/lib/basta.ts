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

export interface CreateItemForSaleInput {
  saleId: string;
  title: string;
  description: string;
  startingBid: number;
  reserve: number;
  openDate: string;
  closingDate: string;
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
