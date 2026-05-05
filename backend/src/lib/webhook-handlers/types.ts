// Basta webhook payload shapes. See references/webhooks.md in the Basta
// skill + docs/memory/architecture/basta-integration.md.

export type BastaActionType =
  | "BidOnItem"
  | "SaleStatusChanged"
  | "ItemsStatusChanged";

export interface BastaReactiveBid {
  bidId: string;
  userId: string;
  amount: number;
  maxAmount: number;
}

export interface BastaSaleState {
  newLeader?: string | null;
  prevLeader?: string | null;
  currentBid?: number | null;
  currentMaxBid?: number | null;
}

export interface BastaBidOnItemData {
  bidId: string;
  saleId: string;
  itemId: string;
  userId: string;
  amount: number;
  maxAmount: number;
  bidDate: string; // ISO-ish
  bidType: "MAX" | "NORMAL";
  saleState: BastaSaleState;
  reactiveBids?: BastaReactiveBid[];
}

export interface BastaSaleStatusChangedData {
  saleId: string;
  saleStatus: "UNPUBLISHED" | "PUBLISHED" | "OPEN" | "CLOSING" | "CLOSED";
}

export interface BastaItemStatusChange {
  itemId: string;
  itemStatus: "UNPUBLISHED" | "PUBLISHED" | "OPEN" | "CLOSING" | "CLOSED";
  saleState?: BastaSaleState;
}

export interface BastaItemsStatusChangedData {
  saleId: string;
  itemStatusChanges: BastaItemStatusChange[];
}

export type BastaWebhookPayload =
  | {
      idempotencyKey: string;
      actionType: "BidOnItem";
      data: BastaBidOnItemData;
    }
  | {
      idempotencyKey: string;
      actionType: "SaleStatusChanged";
      data: BastaSaleStatusChangedData;
    }
  | {
      idempotencyKey: string;
      actionType: "ItemsStatusChanged";
      data: BastaItemsStatusChangedData;
    };
