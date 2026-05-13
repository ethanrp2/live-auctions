"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export interface AuctionListItem {
  id: string;
  title: string;
  status: string | null;
  scheduledDate: string | null;
  bastaSaleId: string | null;
  lotCount: number;
}

export interface SellerHouseSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
  auctionCount: number;
  activeAuctionCount: number;
  lotCount: number;
}

interface Props {
  auctions: AuctionListItem[];
  fetchError: string | null;
  sellerName: string;
  houses: SellerHouseSummary[];
  selectedHouseSlug: string | null;
}

function formatScheduledDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
  const time = d
    .toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
  return `${date} · ${time}`;
}

function statusLabel(status: string | null): string {
  if (!status) return "DRAFT";
  return status.toUpperCase();
}

function statusBadgeClasses(status: string | null): string {
  const s = (status ?? "draft").toLowerCase();
  if (s === "live") return "bg-[#ff0004] text-white";
  if (s === "published" || s === "scheduled") return "bg-black text-white";
  if (s === "ended" || s === "closed" || s === "completed")
    return "bg-[#f3f3f3] text-black/40";
  return "bg-[#f3f3f3] text-black/60";
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "S"}`;
}

function sellerHouseUrl(slug: string): string {
  if (typeof window === "undefined") return `/${slug}`;

  const { protocol, hostname, port } = window.location;
  const hostParts = hostname.split(".");
  const rootHost =
    hostname === "localhost" || hostname.endsWith(".localhost")
      ? "localhost"
      : hostParts.length > 2
        ? hostParts.slice(1).join(".")
        : hostname;
  const portSuffix = port ? `:${port}` : "";

  return `${protocol}//${slug}.${rootHost}${portSuffix}`;
}

function SellerHouseLanding({
  houses,
  fetchError,
}: {
  houses: SellerHouseSummary[];
  fetchError: string | null;
}) {
  const primaryHouse = houses[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p
            className="mb-3 text-[11px] uppercase tracking-widest text-black/40"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            SELLER HOUSES
          </p>
          <h1
            className="text-[36px] leading-none text-black"
            style={{ fontFamily: "var(--font-ivypresto, var(--font-inter))" }}
          >
            Your houses
          </h1>
        </div>
        <span
          className="text-[11px] uppercase tracking-widest text-black/40"
          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
        >
          {houses.length} TOTAL
        </span>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 px-4 py-3 text-[12px] text-[#ff0004]">
          {fetchError}
        </div>
      )}

      {!primaryHouse ? (
        <div className="rounded-[4px] border border-dashed border-[#e5e5e5] bg-[#fafafa] px-6 py-14">
          <p
            className="text-[13px] uppercase tracking-widest text-black/60"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            NO HOUSE ASSIGNED
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {houses.map((house) => (
            <div
              key={house.id}
              className="overflow-hidden rounded-[4px] border border-[#f3f3f3] bg-white"
            >
              <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                <div className="flex min-h-[260px] flex-col justify-between bg-black p-8 text-white">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p
                        className="mb-4 text-[11px] uppercase tracking-widest text-white/45"
                        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                      >
                        HOUSE
                      </p>
                      <h2
                        className="text-[44px] leading-none"
                        style={{ fontFamily: "var(--font-ivypresto, var(--font-inter))" }}
                      >
                        {house.name}
                      </h2>
                    </div>
                    <div
                      className="h-3 w-3 shrink-0"
                      style={{ backgroundColor: house.primaryColor }}
                    />
                  </div>
                  <p
                    className="mt-8 max-w-xl text-[13px] leading-6 text-white/55"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {house.description ?? "Manage this house's auctions, lots, live console, and storefront."}
                  </p>
                </div>

                <div className="flex flex-col justify-between border-l border-[#f3f3f3] p-8">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-[4px] border border-[#f3f3f3] px-4 py-4">
                      <p className="text-[28px] leading-none text-black" style={{ fontFamily: "var(--font-inter)" }}>
                        {house.auctionCount}
                      </p>
                      <p className="mt-3 text-[10px] uppercase tracking-widest text-black/40" style={{ fontFamily: "var(--font-ibm-plex-mono)" }}>
                        {pluralize(house.auctionCount, "AUCTION").replace(/^\d+ /, "")}
                      </p>
                    </div>
                    <div className="rounded-[4px] border border-[#f3f3f3] px-4 py-4">
                      <p className="text-[28px] leading-none text-black" style={{ fontFamily: "var(--font-inter)" }}>
                        {house.activeAuctionCount}
                      </p>
                      <p className="mt-3 text-[10px] uppercase tracking-widest text-black/40" style={{ fontFamily: "var(--font-ibm-plex-mono)" }}>
                        ACTIVE
                      </p>
                    </div>
                    <div className="rounded-[4px] border border-[#f3f3f3] px-4 py-4">
                      <p className="text-[28px] leading-none text-black" style={{ fontFamily: "var(--font-inter)" }}>
                        {house.lotCount}
                      </p>
                      <p className="mt-3 text-[10px] uppercase tracking-widest text-black/40" style={{ fontFamily: "var(--font-ibm-plex-mono)" }}>
                        LOTS
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3">
                    <Link
                      href={`/seller/auctions?house=${encodeURIComponent(house.slug)}`}
                      className="flex h-[50px] items-center justify-center rounded-[4px] bg-black px-5 text-[12px] uppercase tracking-widest text-white transition-opacity hover:opacity-90"
                      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                    >
                      MANAGE HOUSE →
                    </Link>
                    <a
                      href={sellerHouseUrl(house.slug)}
                      className="flex h-[50px] items-center justify-center rounded-[4px] border border-[#e5e5e5] px-5 text-[12px] uppercase tracking-widest text-black/60 transition-colors hover:border-black hover:text-black"
                      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                    >
                      OPEN STOREFRONT →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuctionsListView({
  auctions,
  fetchError,
  sellerName,
  houses,
  selectedHouseSlug,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const selectedHouse = houses.find((house) => house.slug === selectedHouseSlug) ?? null;

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const scheduledIso = new Date(newScheduledDate).toISOString();

      const res = await fetch(`${BACKEND_URL}/api/seller/auctions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || undefined,
          scheduled_date: scheduledIso,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        auction?: { id: string };
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to create auction (HTTP ${res.status})`);
      }

      if (data.auction?.id) {
        router.push(`/seller/auctions/${data.auction.id}`);
      } else {
        router.refresh();
        setShowCreate(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auction");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen w-full flex-col bg-white"
      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      {/* Top bar */}
      <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-[#f3f3f3] bg-black px-5">
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] uppercase tracking-widest text-white/50"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            SELLER CMS
          </span>
          <span className="text-white/20">|</span>
          <span
            className="text-[13px] text-white/80"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {sellerName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedHouse ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="h-[34px] rounded-[4px] bg-white px-4 text-[11px] uppercase tracking-widest text-black transition-opacity hover:opacity-90"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              + NEW AUCTION
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="h-[34px] rounded-[4px] border border-white/25 px-4 text-[11px] uppercase tracking-widest text-white/65 transition-colors hover:border-white hover:text-white disabled:opacity-40"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            {loggingOut ? "LOGGING OUT" : "LOGOUT"}
          </button>
        </div>
      </div>

      {/* Body */}
      {!selectedHouse ? (
        <SellerHouseLanding houses={houses} fetchError={fetchError} />
      ) : (
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Link
                href="/seller/auctions"
                className="mb-3 inline-flex text-[11px] uppercase tracking-widest text-black/40 transition-colors hover:text-black"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                ← HOUSES
              </Link>
              <h1
                className="text-[14px] uppercase tracking-widest text-black"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                {selectedHouse.name} AUCTIONS
              </h1>
            </div>
            <span
              className="text-[11px] uppercase tracking-widest text-black/40"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {auctions.length} TOTAL
            </span>
          </div>

        {fetchError && (
          <div className="mb-4 rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 px-4 py-3 text-[12px] text-[#ff0004]">
            {fetchError}
          </div>
        )}

        {auctions.length === 0 && !fetchError ? (
          <div className="flex flex-col items-center justify-center rounded-[4px] border border-dashed border-[#e5e5e5] bg-[#fafafa] px-6 py-16 text-center">
            <p
              className="mb-2 text-[13px] uppercase tracking-widest text-black/60"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              NO AUCTIONS YET
            </p>
            <p
              className="mb-6 text-[12px] text-black/40"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              Create your first auction for this house.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="h-[50px] rounded-[4px] bg-black px-6 text-[12px] uppercase tracking-widest text-white transition-opacity hover:opacity-90"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              + CREATE AUCTION
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[4px] border border-[#f3f3f3]">
            {/* Header row */}
            <div
              className="grid grid-cols-[2fr_1.4fr_0.8fr_0.6fr_120px] gap-4 border-b border-[#f3f3f3] bg-[#fafafa] px-5 py-3 text-[10px] uppercase tracking-widest text-black/40"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              <span>TITLE</span>
              <span>SCHEDULED</span>
              <span>STATUS</span>
              <span>LOTS</span>
              <span className="text-right">MANAGE</span>
            </div>

            {auctions.map((a) => (
              <Link
                key={a.id}
                href={`/seller/auctions/${a.id}`}
                className="grid grid-cols-[2fr_1.4fr_0.8fr_0.6fr_120px] items-center gap-4 border-b border-[#f3f3f3] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#fafafa]"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-[13px] text-black"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {a.title}
                  </p>
                </div>
                <div
                  className="text-[11px] uppercase text-black/60"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  {formatScheduledDate(a.scheduledDate)}
                </div>
                <div>
                  <span
                    className={`inline-block rounded-[3px] px-2 py-0.5 text-[10px] uppercase tracking-widest ${statusBadgeClasses(a.status)}`}
                    style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                  >
                    {statusLabel(a.status)}
                  </span>
                </div>
                <div
                  className="text-[12px] tabular-nums text-black/60"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  {a.lotCount}
                </div>
                <div className="flex justify-end">
                  <span
                    className="text-[11px] uppercase tracking-widest text-black"
                    style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                  >
                    MANAGE →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Create modal */}
      {selectedHouse && showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !submitting && setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-[4px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="text-[12px] uppercase tracking-widest text-black"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                NEW AUCTION
              </h2>
              <button
                type="button"
                onClick={() => !submitting && setShowCreate(false)}
                className="text-black/40 transition-colors hover:text-black"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 px-3 py-2 text-[11px] text-[#ff0004]">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-widest text-black/60"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  TITLE
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  maxLength={200}
                  className="h-[50px] w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[13px] text-black focus:border-black focus:outline-none"
                  style={{ fontFamily: "var(--font-inter)" }}
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-widest text-black/60"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  DESCRIPTION
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  maxLength={10000}
                  className="w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 py-2 text-[13px] text-black focus:border-black focus:outline-none"
                  style={{ fontFamily: "var(--font-inter)" }}
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-widest text-black/60"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  SCHEDULED DATE
                </label>
                <input
                  type="datetime-local"
                  value={newScheduledDate}
                  onChange={(e) => setNewScheduledDate(e.target.value)}
                  required
                  className="h-[50px] w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[13px] text-black focus:border-black focus:outline-none"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                />
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={submitting}
                  className="h-[50px] flex-1 rounded-[4px] border border-[#e5e5e5] text-[12px] uppercase tracking-widest text-black/60 transition-colors hover:border-black hover:text-black disabled:opacity-40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-[50px] flex-1 rounded-[4px] bg-black text-[12px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  {submitting ? "CREATING…" : "CREATE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
