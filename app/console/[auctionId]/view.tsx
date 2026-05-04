"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  if (isActive) return "LIVE";
  if (isSoldLot(liveStatus)) {
    if (liveStatus === "passed") return "PASS";
    return "SOLD";
  }
  if (isNext) return "NEXT";
  if (isLiveLot(liveStatus)) return "LIVE";
  return "UPCOMING";
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

function useElapsedTimer(wentLiveAt: string | null): string {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!wentLiveAt) return;
    const start = new Date(wentLiveAt).getTime();

    function tick() {
      const diffMs = Date.now() - start;
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      setElapsed(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [wentLiveAt]);

  return elapsed;
}

// ── Countdown pill (live ticking) ──────────────────────────────────────────

function useCountdownDisplay(countdownMs: number | null): string {
  const [display, setDisplay] = useState(() =>
    countdownMs === null ? "--:--" : formatCountdown(countdownMs)
  );

  const deadlineRef = useRef<number | null>(
    countdownMs !== null ? Date.now() + countdownMs : null
  );

  useEffect(() => {
    if (countdownMs === null) {
      deadlineRef.current = null;
      setDisplay("--:--");
      return;
    }
    deadlineRef.current = Date.now() + countdownMs;
    function tick() {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const remaining = Math.max(0, deadline - Date.now());
      setDisplay(formatCountdown(remaining));
    }
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
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
): Promise<{ ok: boolean; error?: string }> {
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
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
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

function AudioIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 text-white/60"
      aria-hidden="true"
    >
      <path
        d="M3 7.5h2l4-4v13l-4-4H3v-5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 7a4 4 0 0 1 0 6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M16 4.5a7 7 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2.5 4l2.5 3 2.5-3"
        stroke="currentColor"
        strokeWidth="1.25"
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
  const [currentLotId, setCurrentLotId] = useState<string | null>(
    auction.currentLotId
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [selectedIncrement, setSelectedIncrement] = useState<number>(INCREMENT_OPTIONS[0]);

  const currentLot = useMemo(
    () => lots.find((l) => l.id === currentLotId) ?? lots[0] ?? null,
    [lots, currentLotId]
  );

  const currentBastaItemId = currentLot?.bastaItemId ?? null;

  const { currentBidCents, countdownMs, saleActivity, bids, questions } =
    useConsoleActivity(
      auction.bastaSaleId ?? null,
      auction.id,
      currentBastaItemId
    );

  const elapsed = useElapsedTimer(auction.wentLiveAt);
  const countdownDisplay = useCountdownDisplay(countdownMs);

  // Max bids on current lot
  const maxBidsOnLot = useMemo(() => {
    if (!currentLot) return [];
    return bids.filter(
      (b) => b.bidType === "MAX"
    );
  }, [bids, currentLot]);

  const highestMaxBid = useMemo(() => {
    if (maxBidsOnLot.length === 0) return null;
    return Math.max(...maxBidsOnLot.map((b) => b.amountCents));
  }, [maxBidsOnLot]);

  // Top bidder (for SELL)
  const topBidder = useMemo(() => {
    const lotBids = bids.filter((b) => {
      // We don't have lot_id on BidFeedRow in the auction-scoped feed.
      // Use the highest amount as proxy for the winner.
      return true;
    });
    if (lotBids.length === 0) return null;
    return lotBids.reduce((best, b) => (b.amountCents > best.amountCents ? b : best));
  }, [bids]);

  // Next lot in sort order
  const nextLot = useMemo(() => {
    if (!currentLot || currentLot.sortOrder == null) return null;
    return (
      lots.find(
        (l) => (l.sortOrder ?? -1) > (currentLot.sortOrder ?? 0) && !isSoldLot(l.liveStatus)
      ) ?? null
    );
  }, [lots, currentLot]);

  const currentLotIndex = useMemo(() => {
    if (!currentLot) return 1;
    const idx = lots.findIndex((l) => l.id === currentLot.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [lots, currentLot]);

  // Image carousel state
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    setImageIndex(0);
  }, [currentLotId]);

  const currentImages = currentLot?.images ?? [];
  const currentImage = currentImages[imageIndex] ?? null;

  // ── Lot queue image carousel lots from saleActivity ────────────────────
  // For live status label, merge saleActivity statuses back if needed.
  // (We use our DB liveStatus as the source of truth for the queue.)

  // ── Actions ────────────────────────────────────────────────────────────

  async function handleSwitchLot(lotId: string) {
    if (lotId === currentLotId || isActing) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPatch(
      `/api/auctions/${auction.id}/current-lot`,
      { lotId }
    );
    if (result.ok) {
      setCurrentLotId(lotId);
    } else {
      setActionError(result.error ?? "Failed to switch lot");
    }
    setIsActing(false);
  }

  async function handleSell() {
    if (!currentLot || isActing) return;
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
      await handleSwitchLot(nextLot.id);
    }
    setIsActing(false);
  }

  async function handlePass() {
    if (!currentLot || isActing) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPost(`/api/auctions/${auction.id}/pass`, {
      lotId: currentLot.id,
    });
    if (!result.ok) {
      setActionError(result.error ?? "Pass failed");
    } else if (nextLot) {
      await handleSwitchLot(nextLot.id);
    }
    setIsActing(false);
  }

  async function handleNextLot() {
    if (!nextLot || isActing) return;
    await handleSwitchLot(nextLot.id);
  }

  async function handleEndAuction() {
    if (isActing) return;
    const confirmed = window.confirm(
      "Are you sure you want to end the auction? This cannot be undone."
    );
    if (!confirmed) return;
    setIsActing(true);
    setActionError(null);
    const result = await apiPost(`/api/auctions/${auction.id}/end`, {});
    if (!result.ok) setActionError(result.error ?? "End auction failed");
    setIsActing(false);
  }

  async function handleDismissQuestion(questionId: string) {
    const supabase = createClient();
    await supabase
      .from("auction_questions")
      .update({ dismissed: true })
      .eq("id", questionId);
  }

  // Visible questions (not dismissed) — the hook already filters, but keep local too
  const visibleQuestions = questions.filter((q) => !q.dismissed);

  // Countdown pill style
  const isClosing = currentBastaItemId
    ? (saleActivity.get(currentBastaItemId)?.status === "CLOSING")
    : false;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-white"
      style={{ minWidth: "1200px", fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex h-[50px] shrink-0 items-center justify-between bg-black px-5">
        {/* Left */}
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-1.5 rounded-[4px] bg-[#ff0004]/10 px-2.5 py-1">
            <PulseDot />
            <span
              className="text-[11px] font-semibold uppercase tracking-widest text-[#ff0004]"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              LIVE
            </span>
          </div>
          <span
            className="text-[11px] uppercase text-white/40"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            — WATCHING
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
            onClick={handleEndAuction}
            disabled={isActing}
            className="rounded-[4px] border border-white/30 px-3 py-1.5 text-[11px] uppercase tracking-widest text-white transition-colors hover:border-white hover:bg-white/10 disabled:opacity-50"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            END AUCTION
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
              {currentLotIndex} OF {lots.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lots.map((lot, idx) => {
              const isActive = lot.id === currentLotId;
              const isNext =
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
                  disabled={isActing}
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
                          isActive
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
                          onClick={() => setImageIndex(i)}
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
                          setImageIndex((i) =>
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
                          setImageIndex((i) =>
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
                      LOT {pad(currentLotIndex)} OF {lots.length}
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
              <div className="mt-2">
                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5",
                    isClosing ? "bg-[#ff0004] text-white" : "bg-[#f3f3f3] text-black/60",
                  ].join(" ")}
                >
                  <ChevronDownIcon className="h-3 w-3" />
                  <span
                    className="text-[13px] tabular-nums"
                    style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                  >
                    {countdownDisplay}
                  </span>
                </div>
              </div>
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
                    className={[
                      "rounded-[5px] py-1.5 text-[11px] transition-colors",
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
                disabled={isActing || currentBidCents == null}
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
                  disabled={isActing}
                  className="flex-1 rounded-[6px] border border-[#e5e5e5] py-2.5 text-[11px] uppercase tracking-widest text-black/60 transition-colors hover:border-black hover:text-black disabled:opacity-40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  PASS
                </button>
                <button
                  type="button"
                  onClick={handleNextLot}
                  disabled={isActing || !nextLot}
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
}: {
  question: QuestionRow;
  onDismiss: (id: string) => void;
}) {
  const color = avatarColor(question.displayName);
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
