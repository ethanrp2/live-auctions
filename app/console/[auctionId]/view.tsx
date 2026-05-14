"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConsoleActivity } from "@/lib/hooks/use-console-activity";
import type { QuestionRow } from "@/lib/hooks/use-console-activity";
import type { BidFeedRow } from "@/lib/hooks/use-bid-feed";
import { formatMoneyCents, pad } from "@/lib/format";
import { formatCountdown } from "@/lib/hooks/use-countdown";
import { LiveKitPublisher } from "@/components/console/livekit-publisher";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuctionConsoleData {
  id: string;
  title: string;
  status: string | null;
  bastaSaleId: string | null;
  currentLotId: string | null;
  wentLiveAt: string | null;
  endedAt: string | null;
  bidIncrementTable: unknown;
  closingTimeCountdownMs: number | null;
}

export interface LotConsoleData {
  id: string;
  title: string;
  images: string[];
  sortOrder: number | null;
  liveStatus: string | null;
  bastaItemId: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  startingBid: number | null;
  description: string | null;
  conditionReport: string | null;
  measurements: string | null;
  provenance: string | null;
  itemLocation: string | null;
  shippingTerms: string | null;
}

interface Props {
  auction: AuctionConsoleData;
  lots: LotConsoleData[];
  sellerName: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const INCREMENT_OPTIONS = [5000, 10000, 20000, 25000]; // cents: $50, $100, $200, $250

// ── Helpers ────────────────────────────────────────────────────────────────

function isSoldLot(liveStatus: string | null): boolean {
  return (
    liveStatus === "sold" ||
    liveStatus === "passed" ||
    liveStatus === "closed"
  );
}

function isLiveLot(liveStatus: string | null): boolean {
  return liveStatus === "live" || liveStatus === "closing";
}

function getLotStatusLabel(
  liveStatus: string | null,
  isActive: boolean,
  isNext: boolean
): string {
  if (liveStatus === "closed") return "CLOSED";
  if (isSoldLot(liveStatus)) {
    if (liveStatus === "passed") return "PASS";
    return "SOLD";
  }
  if (isActive) return "LIVE";
  if (isNext) return "NEXT";
  if (isLiveLot(liveStatus)) return "LIVE";
  return "UPCOMING";
}

function getEffectiveLotStatus(
  lot: LotConsoleData,
  currentSortOrder: number | null,
  isAuctionEnded: boolean
): string | null {
  if (isAuctionEnded) {
    if (lot.liveStatus === "sold" || lot.liveStatus === "passed") {
      return lot.liveStatus;
    }
    if (
      currentSortOrder !== null &&
      lot.sortOrder !== null &&
      lot.sortOrder < currentSortOrder
    ) {
      return "passed";
    }
    return "closed";
  }
  if (
    currentSortOrder !== null &&
    lot.sortOrder !== null &&
    lot.sortOrder < currentSortOrder &&
    lot.liveStatus === "upcoming"
  ) {
    return "passed";
  }
  return lot.liveStatus;
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function avatarColor(str: string): string {
  const colors = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#9b59b6",
    "#f39c12",
    "#1abc9c",
    "#e67e22",
    "#34495e",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Elapsed timer ──────────────────────────────────────────────────────────

function formatElapsedTime(startIso: string, endMs: number): string {
  const diffMs = endMs - new Date(startIso).getTime();
  const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useElapsedTimer(
  wentLiveAt: string | null,
  endedAt: string | null
): string {
  const [elapsed, setElapsed] = useState(() => {
    if (!wentLiveAt) return "00:00:00";
    return formatElapsedTime(
      wentLiveAt,
      endedAt ? new Date(endedAt).getTime() : Date.now()
    );
  });

  useEffect(() => {
    if (!wentLiveAt) {
      setElapsed("00:00:00");
      return;
    }

    if (endedAt) {
      setElapsed(formatElapsedTime(wentLiveAt, new Date(endedAt).getTime()));
      return;
    }

    const liveStartedAt = wentLiveAt;
    function tick() {
      setElapsed(formatElapsedTime(liveStartedAt, Date.now()));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [wentLiveAt, endedAt]);

  return elapsed;
}

// ── Countdown pill (live ticking) ──────────────────────────────────────────

function useCountdownDisplay(countdownMs: number | null): string {
  const [display, setDisplay] = useState(() =>
    countdownMs === null ? "--:--" : formatCountdown(countdownMs)
  );

  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    deadlineRef.current = countdownMs === null ? null : Date.now() + countdownMs;

    function tick() {
      const deadline = deadlineRef.current;
      if (deadline === null) {
        setDisplay("--:--");
        return;
      }
      const remaining = Math.max(0, deadline - Date.now());
      setDisplay(formatCountdown(remaining));
    }

    const initialId = window.setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      window.clearTimeout(initialId);
      clearInterval(id);
    };
  }, [countdownMs]);

  return display;
}

// ── API helpers ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiPost(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

async function apiPatch(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff0004] opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff0004]" />
    </span>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.5V8l2.25 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── ConsoleView ────────────────────────────────────────────────────────────

export function ConsoleView({ auction, lots, sellerName }: Props) {
  const router = useRouter();
  const [auctionStatus, setAuctionStatus] = useState<string | null>(
    auction.status
  );
  const [wentLiveAt, setWentLiveAt] = useState<string | null>(
    auction.wentLiveAt
  );
  const [endedAt, setEndedAt] = useState<string | null>(auction.endedAt);
  const [currentLotId, setCurrentLotId] = useState<string | null>(
    auction.currentLotId
  );
  const [lotStatusOverrides, setLotStatusOverrides] = useState<
    Record<string, string | null>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [selectedIncrement, setSelectedIncrement] = useState<number>(INCREMENT_OPTIONS[0]);

  const isAuctionEnded =
    endedAt !== null || auctionStatus === "ended" || auctionStatus === "closed";
  const isAuctionLive = auctionStatus === "live" && !isAuctionEnded;
  const isAuctionReady = !isAuctionLive && !isAuctionEnded;

  const currentSortOrder = useMemo(
    () =>
      lots.find((lot) => lot.id === currentLotId)?.sortOrder ??
      null,
    [lots, currentLotId]
  );

  const liveLots = useMemo(
    () =>
      lots.map((lot) => {
        const lotWithOverride = {
          ...lot,
          liveStatus: lotStatusOverrides[lot.id] ?? lot.liveStatus,
        };
        return {
          ...lotWithOverride,
          liveStatus: getEffectiveLotStatus(
            lotWithOverride,
            currentSortOrder,
            isAuctionEnded
          ),
        };
      }),
    [lots, lotStatusOverrides, currentSortOrder, isAuctionEnded]
  );

  const currentLot = useMemo(
    () => liveLots.find((l) => l.id === currentLotId) ?? liveLots[0] ?? null,
    [liveLots, currentLotId]
  );

  const currentBastaItemId = currentLot?.bastaItemId ?? null;

  const { currentBidCents, countdownMs, saleActivity, bids, questions, viewerCount } =
    useConsoleActivity(
      auction.bastaSaleId ?? null,
      auction.id,
      currentBastaItemId,
      currentLot?.id ?? null
    );

  const elapsed = useElapsedTimer(wentLiveAt, endedAt);
  const countdownDisplay = useCountdownDisplay(isAuctionLive ? countdownMs : null);

  // Max bids on current lot
  const maxBidsOnLot = useMemo(() => {
    if (!currentLot) return [];
    return bids.filter((b) => b.lotId === currentLot.id && b.bidType === "MAX");
  }, [bids, currentLot]);

  const highestMaxBid = useMemo(() => {
    if (maxBidsOnLot.length === 0) return null;
    return Math.max(...maxBidsOnLot.map((b) => b.amountCents));
  }, [maxBidsOnLot]);

  // Top bidder (for SELL)
  const topBidder = useMemo(() => {
    if (!currentLot) return null;
    const lotBids = bids.filter((b) => b.lotId === currentLot.id);
    if (lotBids.length === 0) return null;
    return lotBids.reduce((best, b) => (b.amountCents > best.amountCents ? b : best));
  }, [bids, currentLot]);

  // Next lot in sort order
  const nextLot = useMemo(() => {
    if (!currentLot || currentLot.sortOrder == null) return null;
    return (
      liveLots.find(
        (l) => (l.sortOrder ?? -1) > (currentLot.sortOrder ?? 0) && !isSoldLot(l.liveStatus)
      ) ?? null
    );
  }, [liveLots, currentLot]);

  const currentLotIndex = useMemo(() => {
    if (!currentLot) return 1;
    const idx = liveLots.findIndex((l) => l.id === currentLot.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [liveLots, currentLot]);

  // Image carousel state
  const [imageSelection, setImageSelection] = useState<{
    lotId: string | null;
    index: number;
  }>({ lotId: null, index: 0 });
  const imageIndex =
    imageSelection.lotId === currentLotId ? imageSelection.index : 0;

  function setCurrentImageIndex(next: number | ((current: number) => number)) {
    setImageSelection((prev) => {
      const currentIndex = prev.lotId === currentLotId ? prev.index : 0;
      return {
        lotId: currentLotId,
        index: typeof next === "function" ? next(currentIndex) : next,
      };
    });
  }

  const currentImages = currentLot?.images ?? [];
  const currentImage = currentImages[imageIndex] ?? null;
  const currentLotIsTerminal = isSoldLot(currentLot?.liveStatus ?? null);
  const controlsDisabled = isActing || !isAuctionLive;

  // ── Lot queue image carousel lots from saleActivity ────────────────────
  // For live status label, merge saleActivity statuses back if needed.
  // (We use our DB liveStatus as the source of truth for the queue.)

  // ── Actions ────────────────────────────────────────────────────────────

  async function handleSwitchLot(lotId: string) {
    if (lotId === currentLotId || isActing || !isAuctionLive) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPatch(
      `/api/auctions/${auction.id}/current-lot`,
      { lotId }
    );
    if (result.ok) {
      setCurrentLotId(lotId);
      setAuctionStatus("live");
      setEndedAt(null);
      if (!wentLiveAt) setWentLiveAt(new Date().toISOString());
      setLotStatusOverrides((prev) => ({ ...prev, [lotId]: "live" }));
    } else {
      setActionError(result.error ?? "Failed to switch lot");
    }
    setIsActing(false);
  }

  async function handleSell() {
    if (!currentLot || isActing || !isAuctionLive) return;
    if (currentLotIsTerminal) return;
    if (!topBidder?.userId || currentBidCents == null) {
      setActionError("No bids on this lot yet.");
      return;
    }
    setIsActing(true);
    setActionError(null);
    const result = await apiPost(`/api/auctions/${auction.id}/sell`, {
      lotId: currentLot.id,
      winnerUserId: topBidder.userId,
      salePriceCents: currentBidCents,
    });
    if (!result.ok) {
      setActionError(result.error ?? "Sell failed");
    } else if (nextLot) {
      setLotStatusOverrides((prev) => ({ ...prev, [currentLot.id]: "sold" }));
      await handleSwitchLot(nextLot.id);
    } else {
      setLotStatusOverrides((prev) => ({ ...prev, [currentLot.id]: "sold" }));
    }
    setIsActing(false);
  }

  async function handlePass() {
    if (!currentLot || isActing || !isAuctionLive || currentLotIsTerminal) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPost(`/api/auctions/${auction.id}/pass`, {
      lotId: currentLot.id,
    });
    if (!result.ok) {
      setActionError(result.error ?? "Pass failed");
    } else if (nextLot) {
      setLotStatusOverrides((prev) => ({ ...prev, [currentLot.id]: "passed" }));
      await handleSwitchLot(nextLot.id);
    } else {
      setLotStatusOverrides((prev) => ({ ...prev, [currentLot.id]: "passed" }));
    }
    setIsActing(false);
  }

  async function handleNextLot() {
    if (!nextLot || isActing || !isAuctionLive) return;
    await handleSwitchLot(nextLot.id);
  }

  async function handleStartAuction() {
    if (isActing || !isAuctionReady || !currentLot) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPatch(
      `/api/auctions/${auction.id}/current-lot`,
      { lotId: currentLot.id }
    );
    if (!result.ok) {
      setActionError(result.error ?? "Start auction failed");
    } else {
      setCurrentLotId(currentLot.id);
      setAuctionStatus("live");
      setEndedAt(null);
      setWentLiveAt(new Date().toISOString());
      setLotStatusOverrides((prev) => ({ ...prev, [currentLot.id]: "live" }));
    }
    setIsActing(false);
  }

  async function handleEndAuction() {
    if (isActing || !isAuctionLive) return;
    const confirmed = window.confirm(
      "End this auction? You can restart it from this console if needed."
    );
    if (!confirmed) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPost(`/api/auctions/${auction.id}/end`, {});
    if (!result.ok) {
      setActionError(result.error ?? "End auction failed");
    } else {
      const data = result.data as { endedAt?: string };
      setAuctionStatus("ended");
      setEndedAt(data.endedAt ?? new Date().toISOString());
      if (currentLot) {
        setLotStatusOverrides((prev) => ({
          ...prev,
          [currentLot.id]: "closed",
        }));
      }
    }
    setIsActing(false);
  }

  async function handleRestartAuction() {
    if (isActing || !isAuctionEnded) return;
    const confirmed = window.confirm("Restart this auction and reopen the current lot?");
    if (!confirmed) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPost(`/api/auctions/${auction.id}/restart`, {});
    if (!result.ok) {
      setActionError(result.error ?? "Restart auction failed");
    } else {
      const data = result.data as {
        currentLotId?: string | null;
        wentLiveAt?: string;
      };
      const nextCurrentLotId = data.currentLotId ?? currentLotId;
      setAuctionStatus("live");
      setEndedAt(null);
      setWentLiveAt(data.wentLiveAt ?? new Date().toISOString());
      if (nextCurrentLotId) {
        setCurrentLotId(nextCurrentLotId);
        setLotStatusOverrides((prev) => ({
          ...prev,
          [nextCurrentLotId]: "live",
        }));
      }
    }
    setIsActing(false);
  }

  function handleBack() {
    router.push(`/seller/auctions/${auction.id}`);
  }

  async function handleDismissQuestion(questionId: string) {
    const result = await apiPost(
      `/api/auctions/${auction.id}/questions/${questionId}/dismiss`,
      {}
    );
    if (!result.ok) {
      setActionError(result.error ?? "Failed to dismiss question");
    }
  }

  async function handleAnswerQuestion(questionId: string, answerText: string) {
    const result = await apiPost(
      `/api/auctions/${auction.id}/questions/${questionId}/answer`,
      { answerText }
    );
    if (!result.ok) {
      setActionError(result.error ?? "Failed to answer question");
    }
  }

  // Visible questions (not dismissed) — the hook already filters, but keep local too
  const visibleQuestions = questions.filter((q) => !q.dismissed);

  // Countdown pill style
  const isClosing = currentBastaItemId
    ? (saleActivity.get(currentBastaItemId)?.status === "CLOSING")
    : false;
  const hasCountdown = isAuctionLive && countdownMs !== null;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-white"
      style={{ minWidth: "1200px", fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex h-[50px] shrink-0 items-center justify-between bg-black px-5">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="h-[30px] rounded-[4px] border border-white/20 bg-white/[0.04] px-2.5 text-[11px] uppercase tracking-widest text-white/60 transition-colors hover:border-white/50 hover:bg-white/10 hover:text-white"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            aria-label="Go back to previous page"
          >
            ← BACK
          </button>
          <span
            className="text-[11px] uppercase tracking-widest text-white/50"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            AUCTION MANAGER
          </span>
          <span className="text-white/20">|</span>
          <span
            className="text-[13px] text-white/80"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {sellerName}
          </span>
        </div>

        {/* Center — LIVE + viewer count */}
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex items-center gap-1.5 rounded-[4px] px-2.5 py-1",
              isAuctionEnded || isAuctionReady ? "bg-white/10" : "bg-[#ff0004]/10",
            ].join(" ")}
          >
            {isAuctionLive && <PulseDot />}
            <span
              className={[
                "text-[11px] font-semibold uppercase tracking-widest",
                isAuctionLive ? "text-[#ff0004]" : "text-white/60",
              ].join(" ")}
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {isAuctionEnded ? "ENDED" : isAuctionLive ? "LIVE" : "READY"}
            </span>
          </div>
          <span
            className="text-[11px] uppercase text-white/40"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {viewerCount} {viewerCount === 1 ? "BUYER" : "BUYERS"} WATCHING
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <LiveKitPublisher auctionId={auction.id} />
          <span
            className="text-[13px] tabular-nums text-white/60"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {elapsed}
          </span>
          <button
            type="button"
            onClick={
              isAuctionEnded
                ? handleRestartAuction
                : isAuctionLive
                  ? handleEndAuction
                  : handleStartAuction
            }
            disabled={isActing || (isAuctionReady && !currentLot)}
            className={[
              "rounded-[4px] border px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isAuctionEnded || isAuctionReady
                ? "border-[#00ad37]/60 text-[#8be09e] hover:border-[#00ad37] hover:bg-[#00ad37]/10"
                : "border-white/30 text-white hover:border-white hover:bg-white/10",
            ].join(" ")}
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {isActing
              ? isAuctionEnded
                ? "RESTARTING..."
                : isAuctionReady
                  ? "STARTING..."
                : "ENDING..."
              : isAuctionEnded
                ? "RESTART AUCTION"
                : isAuctionReady
                  ? "START AUCTION"
                : "END AUCTION"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="shrink-0 bg-red-50 px-5 py-2 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {/* ── Body (3 columns) ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Lot Queue ──────────────────────────────────────── */}
        <div
          className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-[#f3f3f3]"
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#f3f3f3] px-4">
            <span
              className="text-[11px] uppercase tracking-widest text-black"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              LOT QUEUE
            </span>
            <span
              className="text-[11px] text-black/40"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {currentLotIndex} OF {liveLots.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {liveLots.map((lot, idx) => {
              const isActive = lot.id === currentLotId;
              const isNext =
                isAuctionLive &&
                !isActive &&
                !isSoldLot(lot.liveStatus) &&
                nextLot?.id === lot.id;
              const soldStatus = isSoldLot(lot.liveStatus);
              const statusLabel = getLotStatusLabel(
                lot.liveStatus,
                isActive,
                isNext
              );

              return (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => handleSwitchLot(lot.id)}
                  disabled={controlsDisabled}
                  className={[
                    "flex w-full items-center gap-3 border-b border-[#f3f3f3] px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "border-l-2 border-l-[#ff0004] bg-gray-50"
                      : "hover:bg-gray-50",
                  ].join(" ")}
                >
                  {/* Thumbnail */}
                  <div className="h-[50px] w-[50px] shrink-0 overflow-hidden rounded-[4px] bg-[#f3f3f3]">
                    {lot.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lot.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-black/20">
                        —
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="text-[10px] uppercase text-black/40"
                        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                      >
                        LOT {pad(idx + 1)}
                      </span>
                      <span
                        className={[
                          "shrink-0 rounded-[3px] px-1.5 py-0.5 text-[9px] uppercase tracking-widest",
                          isActive && !soldStatus
                            ? "bg-[#ff0004] text-white"
                            : isNext
                            ? "bg-black text-white"
                            : soldStatus
                            ? "bg-[#f3f3f3] text-black/40"
                            : "bg-[#f3f3f3] text-black/60",
                        ].join(" ")}
                        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p
                      className={[
                        "mt-0.5 line-clamp-2 text-[11px] leading-tight",
                        soldStatus ? "text-black/40 line-through" : "text-black",
                      ].join(" ")}
                      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                    >
                      {lot.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CENTER: Current lot detail ───────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {currentLot ? (
            <>
              {/* Header */}
              <div className="flex h-10 shrink-0 items-center border-b border-[#f3f3f3] px-5">
                <span
                  className="text-[11px] uppercase tracking-widest text-black"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  {currentLot.title}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f3f3f3]">
                  {currentImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentImage}
                      alt={currentLot.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-black/20">
                      No image
                    </div>
                  )}

                  {/* Carousel dots */}
                  {currentImages.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {currentImages.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCurrentImageIndex(i)}
                          className={[
                            "h-1.5 w-1.5 rounded-full transition-colors",
                            i === imageIndex
                              ? "bg-white"
                              : "bg-white/40 hover:bg-white/70",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                  )}

                  {/* Prev / Next arrows */}
                  {currentImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentImageIndex((i) =>
                            i === 0 ? currentImages.length - 1 : i - 1
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50"
                        aria-label="Previous image"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                          <path
                            d="M10 4L6 8l4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentImageIndex((i) =>
                            i === currentImages.length - 1 ? 0 : i + 1
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50"
                        aria-label="Next image"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                          <path
                            d="M6 4l4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* Lot details */}
                <div className="p-5">
                  {/* Lot number + title */}
                  <div className="mb-4">
                    <span
                      className="mb-1 block text-[11px] uppercase text-black/40"
                      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                    >
                          LOT {pad(currentLotIndex)} OF {liveLots.length}
                    </span>
                    <h2
                      className="text-xl font-normal leading-snug text-black"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {currentLot.title}
                    </h2>

                    {/* Tags */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {currentLot.estimateLow != null && (
                        <span
                          className="rounded-[4px] bg-[#f3f3f3] px-2 py-0.5 text-[11px] text-black"
                          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                        >
                          EST: {formatMoneyCents(currentLot.estimateLow)}
                          {currentLot.estimateHigh != null &&
                            currentLot.estimateHigh !== currentLot.estimateLow
                            ? ` – ${formatMoneyCents(currentLot.estimateHigh)}`
                            : ""}
                        </span>
                      )}
                      {currentLot.startingBid != null && (
                        <span
                          className="rounded-[4px] bg-[#f3f3f3] px-2 py-0.5 text-[11px] text-black"
                          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                        >
                          STARTS: {formatMoneyCents(currentLot.startingBid)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Text sections */}
                  <div className="flex flex-col gap-4">
                    {currentLot.description && (
                      <LotSection label="DESCRIPTION">
                        <p className="text-sm leading-relaxed text-black">
                          {currentLot.description}
                        </p>
                      </LotSection>
                    )}
                    {currentLot.conditionReport && (
                      <LotSection label="CONDITION REPORT">
                        <p className="text-sm leading-relaxed text-black">
                          {currentLot.conditionReport}
                        </p>
                      </LotSection>
                    )}
                    {currentLot.measurements && (
                      <LotSection label="MEASUREMENTS">
                        <p className="text-sm leading-relaxed text-black">
                          {currentLot.measurements}
                        </p>
                      </LotSection>
                    )}
                    {currentLot.provenance && (
                      <LotSection label="PROVENANCE">
                        <p className="text-sm leading-relaxed text-black">
                          {currentLot.provenance}
                        </p>
                      </LotSection>
                    )}
                    {currentLot.itemLocation && (
                      <LotSection label="ITEM LOCATION">
                        <p className="text-sm leading-relaxed text-black">
                          {currentLot.itemLocation}
                        </p>
                      </LotSection>
                    )}
                    {currentLot.shippingTerms && (
                      <LotSection label="SHIPPING TERMS">
                        <p className="text-sm leading-relaxed text-black">
                          {currentLot.shippingTerms}
                        </p>
                      </LotSection>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-black/30">
              No lots in this auction.
            </div>
          )}
        </div>

        {/* ── RIGHT: Seller Console Panel ──────────────────────────── */}
        <div
          className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-[#f3f3f3]"
        >
          {/* Panel header */}
          <div className="flex h-10 shrink-0 items-center border-b border-[#f3f3f3] px-4">
            <span
              className="text-[11px] uppercase tracking-widest text-black"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              SELLER CONSOLE
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Max bids banner */}
            {maxBidsOnLot.length > 0 && (
              <div className="mx-3 mt-3 rounded-[6px] bg-[#fff7e1] px-3 py-2">
                <p
                  className="text-[11px] uppercase text-[#b45309]"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  {maxBidsOnLot.length} MAX{" "}
                  {maxBidsOnLot.length === 1 ? "BID" : "BIDS"} ON THIS LOT
                  {highestMaxBid != null && (
                    <> | HIGHEST: {formatMoneyCents(highestMaxBid)}</>
                  )}
                </p>
              </div>
            )}

            {/* Current bid */}
            <div className="px-4 pt-4">
              <span
                className="mb-1 block text-[11px] uppercase text-black/40"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                CURRENT BID
              </span>
              <div className="flex items-end gap-2">
                <span
                  className="text-[40px] font-bold leading-none tracking-tight text-black"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {currentBidCents != null
                    ? formatMoneyCents(currentBidCents)
                    : "—"}
                </span>
              </div>

              {/* Countdown pill */}
              {hasCountdown && (
                <div className="mt-2">
                  <div
                    className={[
                      "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5",
                      isAuctionEnded
                        ? "bg-[#f3f3f3] text-black/30"
                        : isClosing
                          ? "bg-[#ff0004] text-white"
                          : "bg-[#f3f3f3] text-black/60",
                    ].join(" ")}
                    title="Lot closing countdown"
                  >
                    <ClockIcon className="h-3 w-3" />
                    <span
                      className="text-[10px] uppercase tracking-wide"
                      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                    >
                      Countdown
                    </span>
                    <span
                      className="text-[13px] tabular-nums"
                      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                    >
                      {countdownDisplay}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Increment selector */}
            <div className="px-4 pt-4">
              <span
                className="mb-2 block text-[11px] uppercase text-black/40"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                INCREMENT
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {INCREMENT_OPTIONS.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => setSelectedIncrement(cents)}
                    disabled={!isAuctionLive}
                    className={[
                      "rounded-[5px] py-1.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      selectedIncrement === cents
                        ? "bg-black text-white"
                        : "border border-[#e5e5e5] text-black hover:border-black",
                    ].join(" ")}
                    style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                  >
                    {formatMoneyCents(cents)}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 pt-4">
              {/* SELL */}
              <button
                type="button"
                onClick={handleSell}
                disabled={
                  isActing ||
                  !isAuctionLive ||
                  currentLotIsTerminal ||
                  currentBidCents == null
                }
                className="w-full rounded-[6px] bg-[#00ad37] py-3 text-[12px] font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                SELL
              </button>

              {/* PASS + NEXT LOT row */}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handlePass}
                  disabled={controlsDisabled || currentLotIsTerminal}
                  className="flex-1 rounded-[6px] border border-[#e5e5e5] py-2.5 text-[11px] uppercase tracking-widest text-black/60 transition-colors hover:border-black hover:text-black disabled:opacity-40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  PASS
                </button>
                <button
                  type="button"
                  onClick={handleNextLot}
                  disabled={controlsDisabled || !nextLot}
                  className="flex-1 rounded-[6px] bg-black py-2.5 text-[11px] uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  NEXT LOT →
                </button>
              </div>
            </div>

            {/* Buyer Questions */}
            <div className="mt-5 border-t border-[#f3f3f3] px-4 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="text-[11px] uppercase tracking-widest text-black"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  BUYER QUESTIONS
                </span>
                {visibleQuestions.length > 0 && (
                  <span
                    className="rounded-full bg-[#ff0004] px-1.5 py-0.5 text-[10px] text-white"
                    style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                  >
                    {visibleQuestions.length}
                  </span>
                )}
              </div>

              {visibleQuestions.length === 0 ? (
                <p
                  className="text-[11px] text-black/30"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  No questions yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {visibleQuestions.map((q) => (
                    <QuestionItem
                      key={q.id}
                      question={q}
                      onDismiss={handleDismissQuestion}
                      onAnswer={handleAnswerQuestion}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Live bid feed */}
            <div className="mt-5 border-t border-[#f3f3f3] px-4 pb-5 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="text-[11px] uppercase tracking-widest text-black"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  LIVE BID FEED
                </span>
                {bids.length > 0 && (
                  <span
                    className="text-[11px] text-black/30"
                    style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                  >
                    {bids.length}
                  </span>
                )}
              </div>

              {bids.length === 0 ? (
                <p
                  className="text-[11px] text-black/30"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  No bids yet.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {bids.slice(0, 20).map((bid) => (
                    <BidFeedItem key={bid.id} bid={bid} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small sub-components ───────────────────────────────────────────────────

function LotSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span
        className="mb-1 block text-[11px] uppercase text-black/40"
        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function QuestionItem({
  question,
  onDismiss,
  onAnswer,
}: {
  question: QuestionRow;
  onDismiss: (id: string) => void;
  onAnswer: (id: string, answerText: string) => void;
}) {
  const color = avatarColor(question.displayName);
  const [answerText, setAnswerText] = useState("");
  const canAnswer = answerText.trim().length >= 2;

  return (
    <div className="flex items-start gap-2 rounded-[6px] bg-[#fafafa] p-2">
      {/* Avatar */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase text-white"
        style={{ backgroundColor: color, fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        {question.displayName.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span
            className="truncate text-[11px] font-semibold text-black"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            @{question.displayName}
          </span>
          <span
            className="shrink-0 text-[10px] text-black/30"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {timeAgo(question.createdAt)}
          </span>
        </div>
        <p
          className="mt-0.5 text-[11px] leading-snug text-black/70"
          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
        >
          {question.questionText}
        </p>
        {question.answerText ? (
          <div className="mt-2 border-l-2 border-black/20 pl-2">
            <span
              className="block text-[9px] uppercase tracking-widest text-black/35"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              Answered
            </span>
            <p
              className="mt-1 text-[11px] leading-snug text-black/70"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {question.answerText}
            </p>
          </div>
        ) : (
          <div className="mt-2 flex gap-1">
            <input
              value={answerText}
              onChange={(event) => setAnswerText(event.target.value)}
              placeholder="Answer buyer"
              className="h-8 min-w-0 flex-1 rounded-[4px] border border-black/10 bg-white px-2 text-[11px] text-black outline-none focus:border-black"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            />
            <button
              type="button"
              onClick={() => {
                onAnswer(question.id, answerText.trim());
                setAnswerText("");
              }}
              disabled={!canAnswer}
              className="h-8 shrink-0 rounded-[4px] bg-black px-2 text-[10px] uppercase tracking-widest text-white disabled:opacity-30"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              Answer
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(question.id)}
        className="mt-0.5 shrink-0 text-black/20 transition-colors hover:text-black/60"
        aria-label="Dismiss question"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BidFeedItem({ bid }: { bid: BidFeedRow }) {
  const color = avatarColor(bid.displayName);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase text-white"
        style={{ backgroundColor: color, fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        {bid.displayName.charAt(0)}
      </div>
      <span
        className="min-w-0 flex-1 truncate text-[11px] text-black/70"
        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        @{bid.displayName}
      </span>
      <span
        className="shrink-0 text-[11px] font-semibold text-black"
        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        {formatMoneyCents(bid.amountCents)}
      </span>
      <span
        className="shrink-0 text-[10px] text-black/30"
        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
      >
        {timeAgo(bid.placedAt)}
      </span>
    </div>
  );
}
