"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/lib/hooks/use-user";
import { useSaleActivity } from "@/lib/hooks/use-sale-activity";
import { useBidFeed } from "@/lib/hooks/use-bid-feed";
import type { BidFeedRow } from "@/lib/hooks/use-bid-feed";
import type { BidIncrementRule } from "@/lib/basta/bid-support";
import { bidErrorMessage } from "@/lib/basta/client";
import { placeBidForLot, computeNextBidAmountCents } from "@/lib/basta/place-bid";
import { LiveTopBar } from "@/components/live/live-top-bar";
import {
  LiveLotRibbon,
  type LiveRibbonLot,
} from "@/components/live/live-lot-ribbon";
import { LiveLotHero } from "@/components/live/live-lot-hero";
import {
  LiveBidHistory,
  type BidFeedEntry,
} from "@/components/live/live-bid-history";
import {
  LiveBidFooter,
  type LiveViewerState,
} from "@/components/live/live-bid-footer";
import { LiveStatusBanner } from "@/components/live/live-status-banner";
import { LiveCustomBidSheet } from "@/components/live/live-custom-bid-sheet";
import { MaxBidSheet } from "@/components/live/max-bid-sheet";
import { LotInfo } from "@/components/storefront/lot-info";
import type { StorefrontLotDetail } from "@/lib/storefront-data";

export interface AuctionData {
  id: string;
  title: string;
  status: string | null;
  bastaSaleId: string | null;
  bidIncrementTable: unknown;
  closingTimeCountdownMs: number | null;
  currentLotId: string | null;
}

export interface LotData {
  id: string;
  title: string;
  images: string[];
  startingBid: number | null;
  sortOrder: number | null;
  liveStatus: string | null;
  bastaItemId: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  description: string | null;
  conditionReport: string | null;
  tags: string[];
}

interface Props {
  auction: AuctionData;
  lots: LotData[];
}

function coerceIncrementTable(raw: unknown): BidIncrementRule[] | null {
  if (!Array.isArray(raw)) return null;
  const rules: BidIncrementRule[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as BidIncrementRule).lowRange === "number" &&
      typeof (item as BidIncrementRule).highRange === "number" &&
      typeof (item as BidIncrementRule).step === "number"
    ) {
      rules.push(item as BidIncrementRule);
    }
  }
  return rules.length > 0 ? rules : null;
}

function normalizeLiveStatus(
  status: string | null
): "upcoming" | "live" | "sold" {
  if (status === "live" || status === "closing") return "live";
  if (status === "sold" || status === "passed" || status === "closed")
    return "sold";
  return "upcoming";
}

function lotToStorefrontDetail(lot: LotData): StorefrontLotDetail {
  return {
    id: lot.id,
    title: lot.title,
    images: lot.images,
    brand: lot.tags.length > 0 ? lot.tags[0] : null,
    estimate_low: lot.estimateLow,
    estimate_high: lot.estimateHigh,
    starting_bid: lot.startingBid,
    sort_order: lot.sortOrder,
    description: lot.description,
    condition_report: lot.conditionReport,
    measurements: null,
    year: null,
    provenance: null,
    item_location: null,
    shipping_terms: null,
    tags: lot.tags,
  };
}

function bidRowToFeedEntry(
  row: BidFeedRow,
  meUserId: string | null
): BidFeedEntry {
  return {
    id: row.id,
    userId: row.userId ?? "",
    handle: row.displayName,
    amountCents: row.amountCents,
    placedAt: row.placedAt,
    isCurrentUser: !!meUserId && row.userId === meUserId,
  };
}

export function LiveAuctionView({ auction, lots }: Props) {
  const { user, session } = useUser();
  const { updates } = useSaleActivity(auction.bastaSaleId ?? null);

  const currentLot = useMemo(
    () => lots.find((l) => l.id === auction.currentLotId) ?? lots[0] ?? null,
    [lots, auction.currentLotId]
  );

  const currentBastaItemId = currentLot?.bastaItemId ?? null;
  const liveForCurrent = currentBastaItemId
    ? updates.get(currentBastaItemId)
    : undefined;

  const incrementTable = useMemo(
    () => coerceIncrementTable(auction.bidIncrementTable),
    [auction.bidIncrementTable]
  );

  const hasBids = !!liveForCurrent && liveForCurrent.bidCount > 0;
  const currentBidCents = hasBids
    ? (liveForCurrent?.currentBid ?? null)
    : null;

  const nextBidCents = useMemo(
    () =>
      computeNextBidAmountCents(
        hasBids ? (liveForCurrent?.currentBid ?? 0) : 0,
        incrementTable,
        currentLot?.startingBid ?? 0
      ),
    [hasBids, liveForCurrent?.currentBid, incrementTable, currentLot?.startingBid]
  );

  const { bids } = useBidFeed(currentLot?.id ?? null);

  const iAmLeader = useMemo(() => {
    if (!user || bids.length === 0) return false;
    return bids[0].userId === user.id;
  }, [bids, user]);

  const [isPlacing, setIsPlacing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [maxSheetOpen, setMaxSheetOpen] = useState(false);
  const [hasBidOnThisLot, setHasBidOnThisLot] = useState(false);

  useEffect(() => {
    setHasBidOnThisLot(false);
    setLastError(null);
  }, [currentLot?.id]);

  const itemStatus = liveForCurrent?.status ?? null;
  const isSold = itemStatus === "CLOSED";

  const viewerState: LiveViewerState = useMemo(() => {
    if (isSold) {
      const winnerHandle = bids[0]?.displayName ?? "\u2014";
      const winningPriceCents =
        liveForCurrent?.currentBid ?? bids[0]?.amountCents ?? 0;
      return { kind: "sold", winnerHandle, winningPriceCents };
    }
    if (iAmLeader) return { kind: "winning" };
    if (hasBidOnThisLot && !iAmLeader) return { kind: "outbid" };
    return { kind: "idle" };
  }, [isSold, iAmLeader, hasBidOnThisLot, bids, liveForCurrent?.currentBid]);

  const countdownMs = useMemo(() => {
    const secs = liveForCurrent?.timeRemaining ?? null;
    return secs == null ? null : secs * 1000;
  }, [liveForCurrent?.timeRemaining]);

  const bannerKind: "winning" | "outbid" | "sold" | "paused" | null = useMemo(() => {
    if (viewerState.kind === "idle") return null;
    return viewerState.kind;
  }, [viewerState]);

  const ribbonLots: LiveRibbonLot[] = useMemo(
    () =>
      lots.map((l) => ({
        id: l.id,
        title: l.title,
        thumbnail: l.images[0] ?? null,
        sort_order: l.sortOrder,
        liveStatus: normalizeLiveStatus(l.liveStatus),
      })),
    [lots]
  );

  const nextLotId = useMemo(() => {
    if (!currentLot || currentLot.sortOrder == null) return null;
    return (
      lots.find((l) => l.sortOrder === (currentLot.sortOrder ?? 0) + 1)?.id ??
      null
    );
  }, [lots, currentLot]);

  const bidFeedEntries: BidFeedEntry[] = useMemo(
    () => bids.map((b) => bidRowToFeedEntry(b, user?.id ?? null)),
    [bids, user?.id]
  );

  const lotIndex = useMemo(() => {
    if (!currentLot) return 1;
    const idx = lots.findIndex((l) => l.id === currentLot.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [lots, currentLot]);

  async function handleOneTapBid(): Promise<void> {
    setLastError(null);

    if (!session?.access_token) {
      setLastError("Please sign in to place a bid.");
      return;
    }
    if (!currentLot) {
      setLastError("No lot is currently live.");
      return;
    }
    if (nextBidCents == null) {
      setLastError("Cannot determine next bid amount.");
      return;
    }

    setIsPlacing(true);
    try {
      const result = await placeBidForLot({
        lotId: currentLot.id,
        type: "NORMAL",
        amountCents: nextBidCents,
        supabaseAccessToken: session.access_token,
      });
      if (!result.ok) {
        setLastError(bidErrorMessage(result.errorCode, result.error));
        return;
      }
      setHasBidOnThisLot(true);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Bid failed.");
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white text-black">
      <LiveTopBar
        tenantName={auction.title}
        tenantLogoUrl={null}
        viewerCount={null}
        onMenu={() => {}}
      />

      {currentLot ? (
        <>
          <LiveLotRibbon
            lots={ribbonLots}
            currentLotId={currentLot.id}
            nextLotId={nextLotId}
          />

          <LiveLotHero images={currentLot.images} title={currentLot.title} />

          {bannerKind && (
            <LiveStatusBanner
              kind={bannerKind}
              winnerHandle={
                viewerState.kind === "sold" ? viewerState.winnerHandle : undefined
              }
              winningPriceCents={
                viewerState.kind === "sold"
                  ? viewerState.winningPriceCents
                  : undefined
              }
            />
          )}

          <div className="p-5">
            <LotInfo
              lot={lotToStorefrontDetail(currentLot)}
              lotIndex={lotIndex}
              totalLots={lots.length}
            />
          </div>

          <LiveBidHistory
            bids={bidFeedEntries}
            totalCount={bidFeedEntries.length}
            onViewAll={() => {}}
          />

          <LiveBidFooter
            currentBidCents={currentBidCents}
            nextIncrementBidCents={nextBidCents}
            countdownMs={countdownMs}
            viewerState={viewerState}
            onOneTapBid={handleOneTapBid}
            onOpenCustomBid={() => setCustomSheetOpen(true)}
            onOpenMaxBid={() => setMaxSheetOpen(true)}
            isPlacing={isPlacing}
            lastError={lastError}
          />

          <LiveCustomBidSheet
            isOpen={customSheetOpen}
            onClose={() => setCustomSheetOpen(false)}
            lotId={currentLot.id}
            startingBidCents={currentLot.startingBid}
            minNextBidCents={nextBidCents}
            onSubmitted={() => {
              setHasBidOnThisLot(true);
              setCustomSheetOpen(false);
            }}
          />

          <MaxBidSheet
            isOpen={maxSheetOpen}
            onClose={() => setMaxSheetOpen(false)}
            lotId={currentLot.id}
            startingBidCents={currentLot.startingBid ?? 0}
            isAuthenticated={!!session}
            onAuthRequired={() => {}}
          />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#5e5e5e]">
          No lots in this auction.
        </div>
      )}
    </div>
  );
}
