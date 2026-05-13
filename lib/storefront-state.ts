export type StorefrontAuctionPhase = "upcoming" | "live" | "ended";
export type StorefrontLotOutcome =
  | "upcoming"
  | "live"
  | "sold"
  | "passed"
  | "ended";

type AuctionLike = {
  status: string | null;
  ended_at?: string | null;
};

type LotLike = {
  live_status?: string | null;
  winning_bid_cents?: number | null;
  sold_at?: string | null;
  winner_user_id?: string | null;
  winner_display_name?: string | null;
};

export function getStorefrontAuctionPhase(
  auction: AuctionLike
): StorefrontAuctionPhase {
  if (auction.ended_at || auction.status === "ended" || auction.status === "closed") {
    return "ended";
  }
  if (auction.status === "live") {
    return "live";
  }
  return "upcoming";
}

export function getStorefrontLotOutcome(
  lot: LotLike,
  auction: AuctionLike
): StorefrontLotOutcome {
  if (lot.live_status === "passed") return "passed";
  if (
    lot.live_status === "sold" ||
    lot.winner_user_id != null ||
    lot.winning_bid_cents != null ||
    lot.sold_at != null
  ) {
    return "sold";
  }
  if (getStorefrontAuctionPhase(auction) === "ended") return "ended";
  if (lot.live_status === "live" || lot.live_status === "closing") return "live";
  return "upcoming";
}

export function getWinnerDisplayLabel(
  lot: Pick<LotLike, "winner_display_name" | "winner_user_id">
): string {
  if (lot.winner_display_name?.trim()) return lot.winner_display_name.trim();
  if (lot.winner_user_id) return "Private Buyer";
  return "—";
}
