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

interface Props {
  auctions: AuctionListItem[];
  fetchError: string | null;
  sellerName: string;
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

export function AuctionsListView({ auctions, fetchError, sellerName }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-[34px] rounded-[4px] bg-white px-4 text-[11px] uppercase tracking-widest text-black transition-opacity hover:opacity-90"
          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
        >
          + NEW AUCTION
        </button>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1
            className="text-[14px] uppercase tracking-widest text-black"
            style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
          >
            YOUR AUCTIONS
          </h1>
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
              Create your first auction to get started.
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

      {/* Create modal */}
      {showCreate && (
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
