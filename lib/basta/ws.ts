/**
 * Basta Client API subscription client (graphql-ws).
 *
 * Thin wrapper around graphql-ws's Client that:
 *   - connects to wss://client.api.basta.app/query
 *   - passes the Basta bidder JWT in the connection_init payload
 *   - refreshes the token via getBastaToken() before (re)connecting
 *   - exposes two typed subscription helpers: subscribeItemUpdates + subscribeSaleUpdates
 *
 * Design notes:
 *   - The token refresh happens inside `connectionParams`, which graphql-ws
 *     invokes on every reconnection attempt. So a stale token is silently
 *     healed on the next reconnect — no extra plumbing needed.
 *   - `getBastaToken` (lib/basta-token.ts) already caches + refreshes its own
 *     JWT, so calling it on every reconnect is cheap.
 *   - We keep one shared Client per (token-provider, ws-url) combo inside the
 *     module. Callers (hooks) subscribe + unsubscribe; the Client stays alive
 *     as long as at least one subscription exists.
 */

import { createClient, type Client, type SubscribePayload } from "graphql-ws";

import { getBastaToken } from "../basta-token";

const BASTA_WS_URL =
  process.env.NEXT_PUBLIC_BASTA_WS_URL ?? "wss://client.api.basta.app/query";

// ---------- Subscription payload types ----------

export type BastaItemStatus =
  | "UNPUBLISHED"
  | "PUBLISHED"
  | "OPEN"
  | "CLOSING"
  | "CLOSED";

export interface ItemUpdatePayload {
  itemId: string;
  currentBid: number;
  bidCount: number;
  status: BastaItemStatus;
  timeRemaining: number | null;
  myBidStatus: {
    isWinning: boolean;
    maxBid: number | null;
  } | null;
}

export interface SaleUpdatePayload {
  itemId: string;
  title: string | null;
  currentBid: number;
  bidCount: number;
  status: BastaItemStatus;
  timeRemaining: number | null;
}

// ---------- Client singleton ----------

let client: Client | null = null;

/**
 * Lazily create (or return) the shared graphql-ws Client. Requires a function
 * that can produce a Supabase access token — the token is read at each
 * reconnect so a refreshed supabase session is picked up automatically.
 */
export function getBastaWsClient(
  getSupabaseAccessToken: () => Promise<string>
): Client {
  if (client) return client;

  client = createClient({
    url: BASTA_WS_URL,
    lazy: true,
    // graphql-ws will call `connectionParams` on every (re)connection, so a
    // stale bidder JWT gets healed automatically.
    connectionParams: async () => {
      const supabaseToken = await getSupabaseAccessToken();
      const bidderToken = await getBastaToken(supabaseToken);
      return { token: bidderToken };
    },
    retryAttempts: Infinity,
    shouldRetry: () => true,
  });

  return client;
}

// Only used by tests / HMR cleanup.
export function resetBastaWsClient(): void {
  if (client) {
    client.dispose();
    client = null;
  }
}

// ---------- Subscription helpers ----------

interface GraphQLError {
  message: string;
  extensions?: Record<string, unknown>;
}

interface Observer<T> {
  next: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
}

/**
 * Low-level subscribe wrapper around graphql-ws. Returns an unsubscribe
 * function. Callers rarely use this directly — prefer the typed helpers below.
 */
export function subscribe<T>(
  bastaClient: Client,
  payload: SubscribePayload,
  observer: Observer<T>
): () => void {
  return bastaClient.subscribe<T>(payload, {
    next: (result) => {
      if (result.errors && result.errors.length > 0) {
        observer.error?.(
          new Error(
            (result.errors as GraphQLError[])
              .map((e) => e.message)
              .join("; ")
          )
        );
        return;
      }
      if (result.data) observer.next(result.data);
    },
    error: (err) => observer.error?.(err),
    complete: () => observer.complete?.(),
  });
}

const ITEM_UPDATES = /* GraphQL */ `
  subscription ItemUpdates($saleId: ID!, $itemId: ID!) {
    itemUpdates(saleId: $saleId, itemId: $itemId) {
      itemId
      currentBid
      bidCount
      status
      timeRemaining
      myBidStatus {
        isWinning
        maxBid
      }
    }
  }
`;

const SALE_UPDATES = /* GraphQL */ `
  subscription SaleUpdates($saleId: ID!) {
    saleUpdates(saleId: $saleId) {
      itemId
      title
      currentBid
      bidCount
      status
      timeRemaining
    }
  }
`;

/**
 * Subscribe to itemUpdates(saleId, itemId). Fires on every bid, status change,
 * or countdown tick for ONE lot. Returns an unsubscribe function.
 */
export function subscribeItemUpdates(
  bastaClient: Client,
  vars: { saleId: string; itemId: string },
  observer: Observer<ItemUpdatePayload>
): () => void {
  return subscribe<{ itemUpdates: ItemUpdatePayload }>(
    bastaClient,
    { query: ITEM_UPDATES, variables: vars },
    {
      next: (data) => observer.next(data.itemUpdates),
      error: observer.error,
      complete: observer.complete,
    }
  );
}

/**
 * Subscribe to saleUpdates(saleId). Fires for EVERY item in the sale — use
 * this on the live screen where the ribbon shows multiple lots.
 */
export function subscribeSaleUpdates(
  bastaClient: Client,
  vars: { saleId: string },
  observer: Observer<SaleUpdatePayload>
): () => void {
  return subscribe<{ saleUpdates: SaleUpdatePayload }>(
    bastaClient,
    { query: SALE_UPDATES, variables: vars },
    {
      next: (data) => observer.next(data.saleUpdates),
      error: observer.error,
      complete: observer.complete,
    }
  );
}
