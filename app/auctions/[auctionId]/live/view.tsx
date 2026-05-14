"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/lib/hooks/use-user";
import { useSaleActivity } from "@/lib/hooks/use-sale-activity";
import { useBidFeed } from "@/lib/hooks/use-bid-feed";
import { createClient } from "@/lib/supabase/client";
import type { BidFeedRow } from "@/lib/hooks/use-bid-feed";
import type { BidIncrementRule } from "@/lib/basta/bid-support";
import { bidErrorMessage } from "@/lib/basta/client";
import { placeBidForLot, computeNextBidAmountCents } from "@/lib/basta/place-bid";
import { LiveTopBar } from "@/components/live/live-top-bar";
import { LiveKitReceiver } from "@/components/live/livekit-receiver";
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
import { AuthModal } from "@/components/storefront/auth-modal";
import { LotInfo } from "@/components/storefront/lot-info";
import { formatMoneyCents } from "@/lib/format";
import type { StorefrontLotDetail } from "@/lib/storefront-data";
import { getStorefrontLotOutcome } from "@/lib/storefront-state";
import { getBadgeTextColor } from "@/lib/color";
import { resolveFontVars } from "@/lib/storefront-fonts";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export interface AuctionData {
  id: string;
  title: string;
  status: string | null;
  endedAt?: string | null;
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
  winnerUserId: string | null;
  winnerDisplayName: string | null;
  winningBidCents: number | null;
  soldAt: string | null;
}

interface Props {
  tenant: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    fontDisplay: string;
    fontMono: string;
  };
  auction: AuctionData;
  lots: LotData[];
}

interface BuyerQuestion {
  id: string;
  questionText: string;
  answerText: string | null;
  createdAt: string;
  dismissed: boolean;
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
  lot: LotData,
  auctionStatus: string | null,
  auctionEndedAt: string | null | undefined
): "upcoming" | "live" | "sold" | "passed" | "ended" {
  return getStorefrontLotOutcome(
    {
      live_status: lot.liveStatus,
      winning_bid_cents: lot.winningBidCents,
      sold_at: lot.soldAt,
    },
    {
      status: auctionStatus,
      ended_at: auctionEndedAt ?? null,
    }
  );
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
    live_status: lot.liveStatus,
    winner_user_id: lot.winnerUserId,
    winner_display_name: lot.winnerDisplayName,
    winning_bid_cents: lot.winningBidCents,
    sold_at: lot.soldAt,
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

function placedAtMs(bid: Pick<BidFeedRow, "placedAt">): number {
  const value = Date.parse(bid.placedAt);
  return Number.isFinite(value) ? value : 0;
}

function compareBidsByLeader(a: BidFeedRow, b: BidFeedRow): number {
  return b.amountCents - a.amountCents || placedAtMs(b) - placedAtMs(a);
}

function compareBidsByRecency(a: BidFeedRow, b: BidFeedRow): number {
  return placedAtMs(b) - placedAtMs(a) || b.amountCents - a.amountCents;
}

export function LiveAuctionView({ tenant, auction, lots }: Props) {
  const { user, session } = useUser();
  const { updates } = useSaleActivity(auction.bastaSaleId ?? null);
  const [auctionStatus, setAuctionStatus] = useState<string | null>(
    auction.status
  );
  const [currentLotId, setCurrentLotId] = useState<string | null>(
    auction.currentLotId
  );
  const [lotStatusOverrides, setLotStatusOverrides] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live:auction-state:${auction.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${auction.id}`,
        },
        (payload) => {
          const next = payload.new as {
            current_lot_id?: string | null;
            status?: string | null;
          };
          if ("current_lot_id" in next) {
            setCurrentLotId(next.current_lot_id ?? null);
          }
          if ("status" in next) {
            setAuctionStatus(next.status ?? null);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lots",
          filter: `auction_id=eq.${auction.id}`,
        },
        (payload) => {
          const next = payload.new as { id?: string; live_status?: string | null };
          if (next.id) {
            setLotStatusOverrides((prev) => ({
              ...prev,
              [next.id as string]: next.live_status ?? null,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [auction.id]);

  useEffect(() => {
    if (!user || !session?.access_token) return;

    const supabase = createClient();
    const channel = supabase.channel(`live:presence:auction:${auction.id}`, {
      config: { presence: { key: user.id } },
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      void channel.track({
        user_id: user.id,
        role: "buyer",
        online_at: new Date().toISOString(),
      });
    });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [auction.id, session?.access_token, user]);

  const liveLots = useMemo(
    () =>
      lots.map((lot) => ({
        ...lot,
        liveStatus: lotStatusOverrides[lot.id] ?? lot.liveStatus,
      })),
    [lots, lotStatusOverrides]
  );

  const currentLot = useMemo(
    () => liveLots.find((l) => l.id === currentLotId) ?? liveLots[0] ?? null,
    [liveLots, currentLotId]
  );

  const currentBastaItemId = currentLot?.bastaItemId ?? null;
  const liveForCurrent = currentBastaItemId
    ? updates.get(currentBastaItemId)
    : undefined;

  const incrementTable = useMemo(
    () => coerceIncrementTable(auction.bidIncrementTable),
    [auction.bidIncrementTable]
  );

  const { bids } = useBidFeed(currentLot?.id ?? null);

  const leaderBid = useMemo(
    () => (bids.length > 0 ? [...bids].sort(compareBidsByLeader)[0] : null),
    [bids]
  );
  const feedHighBidCents = leaderBid?.amountCents ?? null;
  const liveCurrentBidCents = liveForCurrent?.currentBid ?? null;
  const currentBidCents =
    liveCurrentBidCents == null
      ? feedHighBidCents
      : feedHighBidCents == null
        ? liveCurrentBidCents
        : Math.max(liveCurrentBidCents, feedHighBidCents);

  const nextBidCents = useMemo(
    () =>
      computeNextBidAmountCents(
        currentBidCents ?? 0,
        incrementTable,
        currentLot?.startingBid ?? 0
      ),
    [currentBidCents, incrementTable, currentLot?.startingBid]
  );

  const iAmLeader = useMemo(() => {
    if (!user || !leaderBid) return false;
    return (
      leaderBid.userId === user.id &&
      leaderBid.amountCents >= (liveCurrentBidCents ?? 0)
    );
  }, [leaderBid, liveCurrentBidCents, user]);

  const [isPlacing, setIsPlacing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [maxSheetOpen, setMaxSheetOpen] = useState(false);
  const [questionSheetOpen, setQuestionSheetOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bidHistoryOpen, setBidHistoryOpen] = useState(false);
  const [myQuestions, setMyQuestions] = useState<BuyerQuestion[]>([]);
  const [hasBidOnThisLot, setHasBidOnThisLot] = useState(false);

  const loadMyQuestions = useCallback(async () => {
    if (!session?.access_token) {
      setMyQuestions([]);
      return;
    }

    const res = await fetch(
      `${BACKEND_URL}/api/auctions/${auction.id}/questions/mine`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as { questions?: BuyerQuestion[] };
    setMyQuestions(data.questions ?? []);
  }, [auction.id, session?.access_token]);

  useEffect(() => {
    void loadMyQuestions();
    if (!session?.access_token) return;

    const id = window.setInterval(() => {
      void loadMyQuestions();
    }, 2500);
    return () => window.clearInterval(id);
  }, [loadMyQuestions, session?.access_token]);

  useEffect(() => {
    setHasBidOnThisLot(false);
    setLastError(null);
  }, [currentLot?.id]);

  const itemStatus = liveForCurrent?.status ?? null;
  const normalizedAuctionStatus = (auctionStatus ?? "").toLowerCase();
  const hasAuctionEnded =
    normalizedAuctionStatus === "ended" || Boolean(auction.endedAt);
  const isPreliveAuction = normalizedAuctionStatus === "published";
  const isPassed = currentLot?.liveStatus === "passed";
  const isSold =
    itemStatus === "CLOSED" ||
    currentLot?.liveStatus === "sold" ||
    currentLot?.liveStatus === "closed";
  const currentLotIsLive =
    currentLot?.liveStatus === "live" || currentLot?.liveStatus === "closing";
  const currentLotOutcome = currentLot
    ? getStorefrontLotOutcome(
        {
          live_status: currentLot.liveStatus,
          winning_bid_cents: currentLot.winningBidCents,
          sold_at: currentLot.soldAt,
        },
        {
          status: normalizedAuctionStatus,
          ended_at: hasAuctionEnded ? auction.endedAt ?? "" : null,
        }
      )
    : "upcoming";
  const isAcceptingLiveBids =
    normalizedAuctionStatus === "live" &&
    currentLotIsLive &&
    !hasAuctionEnded &&
    !isPassed &&
    !isSold;
  const canPlaceMaxBid = isPreliveAuction && !hasAuctionEnded;

  const viewerState: LiveViewerState = useMemo(() => {
    if (isPassed) return { kind: "passed" };
    if (isSold) {
      const winnerHandle =
        currentLot?.winnerDisplayName ?? leaderBid?.displayName ?? "\u2014";
      const winningPriceCents =
        currentLot?.winningBidCents ??
        liveForCurrent?.currentBid ??
        leaderBid?.amountCents ??
        0;
      return { kind: "sold", winnerHandle, winningPriceCents };
    }
    if (hasAuctionEnded && currentLotOutcome === "ended") return { kind: "no_sale" };
    if (hasAuctionEnded) return { kind: "ended" };
    if (!isAcceptingLiveBids) return { kind: "paused" };
    if (iAmLeader) return { kind: "winning" };
    if (hasBidOnThisLot && !iAmLeader) return { kind: "outbid" };
    return { kind: "idle" };
  }, [
    isPassed,
    isSold,
    hasAuctionEnded,
    isAcceptingLiveBids,
    iAmLeader,
    hasBidOnThisLot,
    leaderBid,
    currentLot?.winnerDisplayName,
    currentLot?.winningBidCents,
    currentLotOutcome,
    liveForCurrent?.currentBid,
  ]);

  const countdownMs = useMemo(() => {
    const secs = liveForCurrent?.timeRemaining ?? null;
    return secs == null ? null : secs * 1000;
  }, [liveForCurrent?.timeRemaining]);

  const bannerKind: "winning" | "outbid" | "sold" | "passed" | "no_sale" | "ended" | "paused" | null = useMemo(() => {
    if (viewerState.kind === "idle") return null;
    return viewerState.kind;
  }, [viewerState]);

  const ribbonLots: LiveRibbonLot[] = useMemo(
    () =>
        liveLots.map((l) => ({
          id: l.id,
          title: l.title,
          thumbnail: l.images[0] ?? null,
          sort_order: l.sortOrder,
          liveStatus: normalizeLiveStatus(
            l,
            normalizedAuctionStatus,
            hasAuctionEnded ? auction.endedAt ?? "" : null
          ),
        })),
    [auction.endedAt, hasAuctionEnded, liveLots, normalizedAuctionStatus]
  );

  const nextLotId = useMemo(() => {
    if (!currentLot || currentLot.sortOrder == null) return null;
    return (
      liveLots.find((l) => l.sortOrder === (currentLot.sortOrder ?? 0) + 1)
        ?.id ?? null
    );
  }, [liveLots, currentLot]);

  const bidFeedEntries: BidFeedEntry[] = useMemo(
    () =>
      [...bids]
        .sort(compareBidsByRecency)
        .map((b) => bidRowToFeedEntry(b, user?.id ?? null)),
    [bids, user?.id]
  );
  const { display: fontDisplay, mono: fontMono } = useMemo(
    () =>
      resolveFontVars({
        ...tenant,
        id: "",
        slug: "",
        description: null,
        hero_image_url: null,
        brand_colors: { primary: tenant.primaryColor },
        logo_url: tenant.logoUrl,
        font_display: tenant.fontDisplay,
        font_mono: tenant.fontMono,
      }),
    [tenant]
  );
  const badgeTextColor = useMemo(
    () => getBadgeTextColor(tenant.primaryColor),
    [tenant.primaryColor]
  );

  const lotIndex = useMemo(() => {
    if (!currentLot) return 1;
    const idx = liveLots.findIndex((l) => l.id === currentLot.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [liveLots, currentLot]);

  async function handleOneTapBid(): Promise<void> {
    setLastError(null);

    if (!session?.access_token) {
      setLastError("Please sign in to place a bid.");
      return;
    }
    if (hasAuctionEnded) {
      setLastError("This auction has ended.");
      return;
    }
    if (!currentLot) {
      setLastError("No lot is currently live.");
      return;
    }
    if (!isAcceptingLiveBids) {
      if (isPreliveAuction) {
        setLastError("Live bidding has not started yet. Use max bid before the auction opens.");
        return;
      }
      setLastError("The seller has not opened this lot for live bidding yet.");
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
        const message = bidErrorMessage(result.errorCode, result.error);
        if (message === "This lot is no longer accepting bids." && !nextLotId) {
          setAuctionStatus("ended");
        }
        setLastError(message);
        return;
      }
      setHasBidOnThisLot(true);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Bid failed.");
    } finally {
      setIsPlacing(false);
    }
  }

  async function handleAskQuestion(questionText: string): Promise<void> {
    if (!session?.access_token) {
      throw new Error("Please sign in to ask a question.");
    }

    const res = await fetch(`${BACKEND_URL}/api/auctions/${auction.id}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ questionText }),
    }).catch(() => null);
    if (!res) {
      throw new Error("Can't reach the API backend. Run `pnpm dev:all` so question submission and seller updates are live.");
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `Question failed (${res.status})`);
    }
    await loadMyQuestions();
  }

  return (
    <div
      className="flex min-h-screen w-full flex-col bg-white text-black lg:h-screen lg:overflow-hidden"
      style={
        {
          "--storefront-primary": tenant.primaryColor,
          "--storefront-font-display": fontDisplay,
          "--storefront-font-mono": fontMono,
          "--storefront-badge-text": badgeTextColor,
        } as React.CSSProperties
      }
    >
      <div className="relative">
        <LiveTopBar
          tenantName={auction.title}
          tenantLogoUrl={tenant.logoUrl}
          accountLabel={user ? "Account" : "Register or Login"}
          accountShortLabel={user ? "Account" : "Sign In"}
          onAccount={() => setAccountOpen(true)}
          audioSlot={<LiveKitReceiver auctionId={auction.id} />}
        />
      </div>

      {currentLot ? (
        <>
          <LiveLotRibbon
            lots={ribbonLots}
            currentLotId={currentLot.id}
            nextLotId={nextLotId}
            onLotClick={setCurrentLotId}
          />

          <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-h-0 lg:overflow-hidden">
              <LiveLotHero
                images={currentLot.images}
                title={currentLot.title}
                heightClass="h-60 lg:h-[calc(100vh-104px)]"
                onAskQuestion={() => setQuestionSheetOpen(true)}
              />
            </div>

            <div className="flex min-h-0 flex-col border-[#f3f3f3] bg-white lg:border-l">
              {bannerKind && (
                <LiveStatusBanner
                  kind={bannerKind}
                  winnerHandle={
                    viewerState.kind === "sold"
                      ? viewerState.winnerHandle
                      : undefined
                  }
                  winningPriceCents={
                    viewerState.kind === "sold"
                      ? viewerState.winningPriceCents
                      : undefined
                  }
                />
              )}

              <div className="min-h-0 flex-1 lg:overflow-y-auto">
                <div className="p-5">
                  <LotInfo
                    lot={lotToStorefrontDetail(currentLot)}
                    auction={{
                      id: auction.id,
                      title: auction.title,
                      description: null,
                      scheduled_date: auction.endedAt ?? new Date().toISOString(),
                      status: normalizedAuctionStatus,
                      current_lot_id: currentLotId,
                      went_live_at: null,
                      ended_at: auction.endedAt ?? null,
                      lots: [],
                    }}
                    lotIndex={lotIndex}
                    totalLots={lots.length}
                  />
                </div>

                <LiveBidHistory
                  bids={bidFeedEntries}
                  totalCount={bidFeedEntries.length}
                  onViewAll={() => setBidHistoryOpen(true)}
                />

                <BuyerQuestionsPanel questions={myQuestions} />
              </div>

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
                showMaxBid={canPlaceMaxBid}
              />
            </div>
          </div>

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

          <LiveQuestionSheet
            isOpen={questionSheetOpen}
            onClose={() => setQuestionSheetOpen(false)}
            isAuthenticated={!!session}
            questions={myQuestions}
            onSubmit={handleAskQuestion}
          />

          <LiveBidHistorySheet
            isOpen={bidHistoryOpen}
            onClose={() => setBidHistoryOpen(false)}
            bids={bidFeedEntries}
          />

          <AuthModal
            isOpen={accountOpen}
            onClose={() => setAccountOpen(false)}
            onComplete={() => setAccountOpen(false)}
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

function BuyerQuestionsPanel({ questions }: { questions: BuyerQuestion[] }) {
  if (questions.length === 0) return null;

  const visible = questions.slice(0, 3);
  return (
    <section
      className="border-b border-[#f3f3f3] px-5 py-4"
      style={{ fontFamily: "var(--storefront-font-mono)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[-0.02em] text-black">
          Your Questions
        </span>
        <span className="text-[11px] uppercase tracking-[-0.02em] text-[#9c9c9c]">
          {questions.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((question) => (
          <div key={question.id} className="border border-[#f3f3f3] p-3">
            <p
              className="text-[12px] leading-5 text-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            >
              {question.questionText}
            </p>
            {question.answerText ? (
              <div className="mt-3 border-l-2 border-black pl-3">
                <p className="text-[10px] uppercase tracking-[-0.02em] text-[#5e5e5e]">
                  Seller Answer
                </p>
                <p
                  className="mt-1 text-[12px] leading-5 text-black"
                  style={{ fontFamily: "var(--storefront-font-display)" }}
                >
                  {question.answerText}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[10px] uppercase tracking-[-0.02em] text-[#9c9c9c]">
                Awaiting seller answer
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveQuestionSheet({
  isOpen,
  onClose,
  isAuthenticated,
  questions,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  questions: BuyerQuestion[];
  onSubmit: (questionText: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setInput("");
    setStatus("idle");
    setError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleClose, isOpen]);

  const trimmed = input.trim();
  const canSubmit = isAuthenticated && trimmed.length >= 3 && status !== "submitting";

  async function handleSubmit() {
    if (!isAuthenticated) {
      setError("Please sign in to ask a question.");
      return;
    }
    if (trimmed.length < 3) {
      setError("Enter a question for the seller.");
      return;
    }

    setStatus("submitting");
    setError(null);
    try {
      await onSubmit(trimmed);
      setInput("");
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Question failed.");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-[4px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(event) => event.stopPropagation()}
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-[-0.02em] text-black">
              Ask The Seller
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#9c9c9c]">
              [ESC]
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] hover:text-black"
            >
              Close
            </button>
          </div>
        </div>

        <textarea
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setStatus("idle");
            setError(null);
          }}
          disabled={status === "submitting"}
          maxLength={1000}
          rows={4}
          placeholder="Ask about condition, provenance, shipping, or pickup."
          className="min-h-[112px] w-full resize-none border border-[#bababa] bg-white p-3 text-sm tracking-[-0.02em] text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
          style={{ fontFamily: "var(--storefront-font-display)" }}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex h-[50px] items-center justify-center rounded-[2px] bg-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <span className="text-sm uppercase tracking-[-0.02em] text-white">
            {status === "submitting" ? "Sending" : "Send Question"}
          </span>
        </button>

        {status === "sent" && (
          <p className="text-center text-xs text-[#00a65a]" role="status">
            Question sent to the seller.
          </p>
        )}
        {error && (
          <p className="text-center text-xs text-[#c11]" role="alert">
            {error}
          </p>
        )}

        {questions.length > 0 && (
          <div className="border-t border-[#f3f3f3] pt-4">
            <p className="mb-3 text-xs uppercase tracking-[-0.02em] text-black">
              Recent Questions
            </p>
            <div className="flex flex-col gap-3">
              {questions.slice(0, 5).map((question) => (
                <div key={question.id} className="border border-[#f3f3f3] p-3">
                  <p
                    className="text-[12px] leading-5 text-black"
                    style={{ fontFamily: "var(--storefront-font-display)" }}
                  >
                    {question.questionText}
                  </p>
                  {question.answerText ? (
                    <p
                      className="mt-2 text-[12px] leading-5 text-black"
                      style={{ fontFamily: "var(--storefront-font-display)" }}
                    >
                      <span className="font-medium">Seller:</span>{" "}
                      {question.answerText}
                    </p>
                  ) : (
                    <p className="mt-2 text-[10px] uppercase tracking-[-0.02em] text-[#9c9c9c]">
                      Awaiting seller answer
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveBidHistorySheet({
  isOpen,
  onClose,
  bids,
}: {
  isOpen: boolean;
  onClose: () => void;
  bids: BidFeedEntry[];
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f3f3f3] px-6 py-5">
          <h2
            className="text-xl text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            Bid History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] transition-colors hover:text-black"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {bids.length === 0 ? (
            <p
              className="text-sm text-[#5e5e5e]"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            >
              No bids have been mirrored for this lot yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-start justify-between rounded border border-[#f3f3f3] px-3 py-3"
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-xs uppercase tracking-[-0.02em] text-black"
                      style={{ fontFamily: "var(--storefront-font-mono)" }}
                    >
                      @{bid.handle}
                    </span>
                    <span
                      className="text-sm text-[#5e5e5e]"
                      style={{ fontFamily: "var(--storefront-font-display)" }}
                    >
                      {new Date(bid.placedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <span
                    className="text-sm text-black"
                    style={{ fontFamily: "var(--storefront-font-mono)" }}
                  >
                    {formatMoneyCents(bid.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
