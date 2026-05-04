"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoneyCents, parseDollarsToCents } from "@/lib/format";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────

export interface EditorAuction {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  scheduledDate: string | null;
  bastaSaleId: string | null;
  currentLotId: string | null;
}

export interface EditorLot {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  conditionReport: string | null;
  measurements: string | null;
  year: number | null;
  provenance: string | null;
  itemLocation: string | null;
  shippingTerms: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  startingBid: number | null;
  reserve: number | null;
  tags: string[];
  sortOrder: number | null;
  status: string | null;
  bastaItemId: string | null;
}

interface Props {
  auction: EditorAuction;
  initialLots: EditorLot[];
  sellerName: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function moneyInputValue(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function parseMoneyInput(val: string): number | null {
  if (!val.trim()) return null;
  try {
    return parseDollarsToCents(val);
  } catch {
    return null;
  }
}

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // Format: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const token = await getToken();
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: d.error ?? `HTTP ${res.status}` };
    }
    const d = await res.json().catch(() => ({}));
    return { ok: true, data: d };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

// ── Label/input reusables ──────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-1 block text-[10px] uppercase tracking-widest text-black/40"
      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      {children}
    </span>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  required,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      className="h-10 w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[13px] text-black focus:border-black focus:outline-none"
      style={{ fontFamily: "var(--font-inter)" }}
    />
  );
}

function TextareaInput({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 py-2 text-[13px] text-black focus:border-black focus:outline-none"
      style={{ fontFamily: "var(--font-inter)" }}
    />
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-black/40">$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0.00"}
        className="h-10 w-full rounded-[4px] border border-[#f3f3f3] bg-white pl-6 pr-3 text-[13px] text-black focus:border-black focus:outline-none"
        style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
      />
    </div>
  );
}

// ── Lot form ───────────────────────────────────────────────────────────────

interface LotFormState {
  title: string;
  description: string;
  conditionReport: string;
  measurements: string;
  year: string;
  provenance: string;
  itemLocation: string;
  shippingTerms: string;
  estimateLow: string;
  estimateHigh: string;
  startingBid: string;
  reserve: string;
  tags: string;
  images: string[];
}

function lotToFormState(lot: EditorLot): LotFormState {
  return {
    title: lot.title,
    description: lot.description ?? "",
    conditionReport: lot.conditionReport ?? "",
    measurements: lot.measurements ?? "",
    year: lot.year != null ? String(lot.year) : "",
    provenance: lot.provenance ?? "",
    itemLocation: lot.itemLocation ?? "",
    shippingTerms: lot.shippingTerms ?? "",
    estimateLow: moneyInputValue(lot.estimateLow),
    estimateHigh: moneyInputValue(lot.estimateHigh),
    startingBid: moneyInputValue(lot.startingBid),
    reserve: moneyInputValue(lot.reserve),
    tags: lot.tags.join(", "),
    images: lot.images,
  };
}

function emptyFormState(): LotFormState {
  return {
    title: "",
    description: "",
    conditionReport: "",
    measurements: "",
    year: "",
    provenance: "",
    itemLocation: "",
    shippingTerms: "",
    estimateLow: "",
    estimateHigh: "",
    startingBid: "",
    reserve: "",
    tags: "",
    images: [],
  };
}

function formStateToBody(
  f: LotFormState
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: f.title.trim(),
  };
  if (f.description.trim()) body.description = f.description.trim();
  if (f.conditionReport.trim()) body.condition_report = f.conditionReport.trim();
  if (f.measurements.trim()) body.measurements = f.measurements.trim();
  if (f.year.trim()) {
    const y = parseInt(f.year, 10);
    if (!isNaN(y)) body.year = y;
  }
  if (f.provenance.trim()) body.provenance = f.provenance.trim();
  if (f.itemLocation.trim()) body.item_location = f.itemLocation.trim();
  if (f.shippingTerms.trim()) body.shipping_terms = f.shippingTerms.trim();
  const estLow = parseMoneyInput(f.estimateLow);
  if (estLow != null) body.estimate_low = estLow;
  const estHigh = parseMoneyInput(f.estimateHigh);
  if (estHigh != null) body.estimate_high = estHigh;
  const startingBid = parseMoneyInput(f.startingBid);
  if (startingBid != null) body.starting_bid = startingBid;
  const reserve = parseMoneyInput(f.reserve);
  if (reserve != null) body.reserve = reserve;
  if (f.tags.trim()) {
    body.tags = f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (f.images.length > 0) body.images = f.images;
  return body;
}

// ── LotEditor panel ────────────────────────────────────────────────────────

function LotEditor({
  auctionId,
  lot,
  onSave,
  onCancel,
  onDelete,
}: {
  auctionId: string;
  lot: EditorLot | null; // null = creating new
  onSave: (updatedLot: EditorLot) => void;
  onCancel: () => void;
  onDelete?: (lotId: string) => void;
}) {
  const [form, setForm] = useState<LotFormState>(
    lot ? lotToFormState(lot) : emptyFormState()
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof LotFormState>(key: K, val: LotFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const uploadedUrls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        // Get a signed upload URL
        const res = await fetch(
          `${BACKEND_URL}/api/seller/auctions/${auctionId}/images/signed-upload-url`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              filename: file.name,
              content_type: file.type,
              lot_id: lot?.id ?? "new",
            }),
          }
        );
        if (!res.ok) {
          throw new Error("Failed to get upload URL");
        }
        const { signedUrl, publicUrl } = (await res.json()) as {
          signedUrl: string;
          publicUrl: string;
        };
        // Upload directly to the signed URL
        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        uploadedUrls.push(publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Image upload failed");
      }
    }
    if (uploadedUrls.length > 0) {
      set("images", [...form.images, ...uploadedUrls]);
    }
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    const body = formStateToBody(form);
    const path = lot
      ? `/api/seller/auctions/${auctionId}/lots/${lot.id}`
      : `/api/seller/auctions/${auctionId}/lots`;
    const method = lot ? "PATCH" : "POST";
    const result = await apiRequest(method, path, body);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Save failed");
      return;
    }
    const saved = ((result.data as { lot?: EditorLot })?.lot) as EditorLot;
    onSave(saved);
  }

  async function handleDelete() {
    if (!lot || !onDelete) return;
    if (!window.confirm(`Delete "${lot.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    const result = await apiRequest(
      "DELETE",
      `/api/seller/auctions/${auctionId}/lots/${lot.id}`
    );
    setDeleting(false);
    if (!result.ok) {
      setError(result.error ?? "Delete failed");
      return;
    }
    onDelete(lot.id);
  }

  const mono = { fontFamily: "var(--font-ibm-plex-mono)" };
  const inter = { fontFamily: "var(--font-inter)" };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 px-3 py-2 text-[11px] text-[#ff0004]" style={mono}>
          {error}
        </div>
      )}

      {/* Images */}
      <div>
        <FieldLabel>IMAGES</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {form.images.map((url, i) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-[4px] bg-[#f3f3f3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => set("images", form.images.filter((_, idx) => idx !== i))}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 text-white text-xs transition-opacity group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 items-center justify-center rounded-[4px] border border-dashed border-[#d0d0d0] text-[11px] text-black/30 transition-colors hover:border-black/40 disabled:opacity-40"
            style={mono}
          >
            {uploading ? "…" : "+"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleImageUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Title */}
      <div>
        <FieldLabel>TITLE *</FieldLabel>
        <TextInput value={form.title} onChange={(v) => set("title", v)} required maxLength={300} />
      </div>

      {/* Description */}
      <div>
        <FieldLabel>DESCRIPTION</FieldLabel>
        <TextareaInput value={form.description} onChange={(v) => set("description", v)} rows={3} />
      </div>

      {/* Condition report */}
      <div>
        <FieldLabel>CONDITION REPORT</FieldLabel>
        <TextareaInput value={form.conditionReport} onChange={(v) => set("conditionReport", v)} rows={3} />
      </div>

      {/* Measurements */}
      <div>
        <FieldLabel>MEASUREMENTS</FieldLabel>
        <TextareaInput value={form.measurements} onChange={(v) => set("measurements", v)} rows={2} />
      </div>

      {/* Money row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>ESTIMATE LOW</FieldLabel>
          <MoneyInput value={form.estimateLow} onChange={(v) => set("estimateLow", v)} />
        </div>
        <div>
          <FieldLabel>ESTIMATE HIGH</FieldLabel>
          <MoneyInput value={form.estimateHigh} onChange={(v) => set("estimateHigh", v)} />
        </div>
        <div>
          <FieldLabel>STARTING BID</FieldLabel>
          <MoneyInput value={form.startingBid} onChange={(v) => set("startingBid", v)} />
        </div>
        <div>
          <FieldLabel>RESERVE</FieldLabel>
          <MoneyInput value={form.reserve} onChange={(v) => set("reserve", v)} />
        </div>
      </div>

      {/* Year + Provenance */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>YEAR</FieldLabel>
          <input
            type="number"
            min={0}
            max={9999}
            value={form.year}
            onChange={(e) => set("year", e.target.value)}
            className="h-10 w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[13px] text-black focus:border-black focus:outline-none"
            style={mono}
          />
        </div>
        <div>
          <FieldLabel>PROVENANCE</FieldLabel>
          <TextInput value={form.provenance} onChange={(v) => set("provenance", v)} />
        </div>
      </div>

      {/* Location + Shipping */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>ITEM LOCATION</FieldLabel>
          <TextInput value={form.itemLocation} onChange={(v) => set("itemLocation", v)} />
        </div>
        <div>
          <FieldLabel>SHIPPING TERMS</FieldLabel>
          <TextInput value={form.shippingTerms} onChange={(v) => set("shippingTerms", v)} />
        </div>
      </div>

      {/* Tags */}
      <div>
        <FieldLabel>TAGS (comma-separated)</FieldLabel>
        <TextInput value={form.tags} onChange={(v) => set("tags", v)} placeholder="CHROME HEARTS, VINTAGE, DENIM" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {lot && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="h-10 rounded-[4px] border border-[#ff0004]/30 px-4 text-[11px] uppercase tracking-widest text-[#ff0004] transition-colors hover:bg-[#ff0004]/5 disabled:opacity-40"
            style={mono}
          >
            {deleting ? "DELETING…" : "DELETE"}
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-10 rounded-[4px] border border-[#e5e5e5] px-4 text-[11px] uppercase tracking-widest text-black/60 transition-colors hover:border-black hover:text-black disabled:opacity-40"
          style={mono}
        >
          CANCEL
        </button>
        <button
          type="submit"
          disabled={saving || !form.title.trim()}
          className="h-10 rounded-[4px] bg-black px-6 text-[11px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={mono}
        >
          {saving ? "SAVING…" : lot ? "SAVE CHANGES" : "ADD LOT"}
        </button>
      </div>
    </form>
  );
}

// ── Main AuctionEditorView ─────────────────────────────────────────────────

export function AuctionEditorView({ auction: initialAuction, initialLots, sellerName }: Props) {
  const router = useRouter();
  const mono = { fontFamily: "var(--font-ibm-plex-mono)" };
  const inter = { fontFamily: "var(--font-inter)" };

  // Auction metadata edit
  const [auction, setAuction] = useState(initialAuction);
  const [editTitle, setEditTitle] = useState(initialAuction.title);
  const [editDescription, setEditDescription] = useState(initialAuction.description ?? "");
  const [editScheduledDate, setEditScheduledDate] = useState(isoToDatetimeLocal(initialAuction.scheduledDate));
  const [savingAuction, setSavingAuction] = useState(false);
  const [auctionError, setAuctionError] = useState<string | null>(null);
  const [auctionSaved, setAuctionSaved] = useState(false);

  // Lots
  const [lots, setLots] = useState<EditorLot[]>(initialLots);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [creatingLot, setCreatingLot] = useState(false);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const isDraft = (auction.status ?? "draft").toLowerCase() === "draft";

  const selectedLot = selectedLotId ? lots.find((l) => l.id === selectedLotId) ?? null : null;

  // Auction save
  async function handleSaveAuction(e: React.FormEvent) {
    e.preventDefault();
    setSavingAuction(true);
    setAuctionError(null);
    setAuctionSaved(false);
    const body: Record<string, unknown> = {};
    if (editTitle.trim()) body.title = editTitle.trim();
    if (editDescription.trim()) body.description = editDescription.trim();
    if (editScheduledDate) body.scheduled_date = new Date(editScheduledDate).toISOString();
    const result = await apiRequest("PATCH", `/api/seller/auctions/${auction.id}`, body);
    setSavingAuction(false);
    if (!result.ok) {
      setAuctionError(result.error ?? "Save failed");
      return;
    }
    const updated = ((result.data as { auction?: EditorAuction })?.auction) as EditorAuction;
    if (updated) setAuction(updated);
    setAuctionSaved(true);
    setTimeout(() => setAuctionSaved(false), 2000);
  }

  // Lot reorder (up/down)
  async function handleReorder(lotId: string, dir: "up" | "down") {
    const idx = lots.findIndex((l) => l.id === lotId);
    if (idx < 0) return;
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= lots.length) return;
    const reordered = [...lots];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setLots(reordered);
    // Persist
    const result = await apiRequest(
      "PATCH",
      `/api/seller/auctions/${auction.id}/lots/reorder`,
      { lot_ids: reordered.map((l) => l.id) }
    );
    if (!result.ok) {
      // Revert
      setLots(lots);
    }
  }

  // Publish
  async function handlePublish() {
    if (!window.confirm("Publish this auction? Once published, lot metadata cannot be changed.")) return;
    setPublishing(true);
    setPublishError(null);
    const result = await apiRequest("POST", `/api/seller/auctions/${auction.id}/publish`);
    setPublishing(false);
    if (!result.ok) {
      setPublishError(result.error ?? "Publish failed");
      return;
    }
    router.push(`/console/${auction.id}`);
  }

  // Lot saved
  function handleLotSaved(saved: EditorLot) {
    setLots((prev) => {
      const existing = prev.findIndex((l) => l.id === saved.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setCreatingLot(false);
    setSelectedLotId(saved.id);
  }

  function handleLotDeleted(lotId: string) {
    setLots((prev) => prev.filter((l) => l.id !== lotId));
    setSelectedLotId(null);
    setCreatingLot(false);
  }

  const statusBadge = (() => {
    const s = (auction.status ?? "draft").toLowerCase();
    if (s === "live") return "bg-[#ff0004] text-white";
    if (s === "published") return "bg-black text-white";
    if (s === "ended") return "bg-[#f3f3f3] text-black/40";
    return "bg-[#f3f3f3] text-black/60";
  })();

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-[#f3f3f3] bg-black px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/seller/auctions")}
            className="text-[11px] uppercase tracking-widest text-white/50 hover:text-white"
            style={mono}
          >
            ← AUCTIONS
          </button>
          <span className="text-white/20">/</span>
          <span className="truncate max-w-[300px] text-[13px] text-white/80" style={mono}>
            {auction.title}
          </span>
          <span className={`rounded-[3px] px-2 py-0.5 text-[10px] uppercase tracking-widest ${statusBadge}`} style={mono}>
            {(auction.status ?? "DRAFT").toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {publishError && (
            <span className="text-[11px] text-[#ff0004]" style={mono}>{publishError}</span>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || lots.length === 0}
              className="h-[34px] rounded-[4px] bg-[#00ad37] px-4 text-[11px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={mono}
            >
              {publishing ? "PUBLISHING…" : "PUBLISH AUCTION →"}
            </button>
          )}
          {!isDraft && (
            <button
              type="button"
              onClick={() => router.push(`/console/${auction.id}`)}
              className="h-[34px] rounded-[4px] border border-white/30 px-4 text-[11px] uppercase tracking-widest text-white transition-colors hover:border-white"
              style={mono}
            >
              OPEN CONSOLE →
            </button>
          )}
        </div>
      </div>

      {/* Body: 2 columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: auction metadata */}
        <div className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-[#f3f3f3]">
          <div className="border-b border-[#f3f3f3] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-black/40" style={mono}>
              AUCTION DETAILS
            </p>
          </div>
          <form onSubmit={handleSaveAuction} className="flex flex-col gap-4 px-5 py-5">
            {auctionError && (
              <div className="rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 px-3 py-2 text-[11px] text-[#ff0004]" style={mono}>
                {auctionError}
              </div>
            )}
            {auctionSaved && (
              <div className="rounded-[4px] bg-[#00ad37]/10 px-3 py-2 text-[11px] text-[#00ad37]" style={mono}>
                SAVED ✓
              </div>
            )}

            <div>
              <FieldLabel>TITLE</FieldLabel>
              <TextInput value={editTitle} onChange={setEditTitle} required maxLength={200} />
            </div>
            <div>
              <FieldLabel>DESCRIPTION</FieldLabel>
              <TextareaInput value={editDescription} onChange={setEditDescription} rows={4} />
            </div>
            <div>
              <FieldLabel>SCHEDULED DATE</FieldLabel>
              <input
                type="datetime-local"
                value={editScheduledDate}
                onChange={(e) => setEditScheduledDate(e.target.value)}
                className="h-10 w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[12px] text-black focus:border-black focus:outline-none"
                style={mono}
              />
            </div>

            {isDraft && (
              <button
                type="submit"
                disabled={savingAuction}
                className="h-10 rounded-[4px] bg-black text-[11px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={mono}
              >
                {savingAuction ? "SAVING…" : "SAVE DETAILS"}
              </button>
            )}
          </form>

          {/* Lot count */}
          <div className="mt-auto border-t border-[#f3f3f3] px-5 py-3">
            <p className="text-[10px] uppercase tracking-widest text-black/40" style={mono}>
              {lots.length} LOT{lots.length !== 1 ? "S" : ""} IN THIS AUCTION
            </p>
          </div>
        </div>

        {/* RIGHT: lot list + editor */}
        <div className="flex flex-1 overflow-hidden">
          {/* Lot list */}
          <div className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-[#f3f3f3]">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#f3f3f3] px-4">
              <span className="text-[10px] uppercase tracking-widest text-black/40" style={mono}>
                LOT QUEUE
              </span>
              {isDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLotId(null);
                    setCreatingLot(true);
                  }}
                  className="text-[11px] uppercase tracking-widest text-black transition-opacity hover:opacity-60"
                  style={mono}
                >
                  + ADD LOT
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {lots.length === 0 && (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <p className="text-[11px] uppercase text-black/30" style={mono}>NO LOTS YET</p>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => setCreatingLot(true)}
                      className="mt-3 text-[11px] uppercase tracking-widest text-black underline"
                      style={mono}
                    >
                      ADD FIRST LOT
                    </button>
                  )}
                </div>
              )}

              {lots.map((lot, idx) => {
                const isSelected = lot.id === selectedLotId;
                return (
                  <div
                    key={lot.id}
                    className={[
                      "group flex items-center gap-2 border-b border-[#f3f3f3] px-3 py-2.5",
                      isSelected ? "bg-black/5 border-l-2 border-l-black" : "hover:bg-[#fafafa]",
                    ].join(" ")}
                  >
                    {/* Thumbnail */}
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[3px] bg-[#f3f3f3]">
                      {lot.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={lot.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-black/20">—</div>
                      )}
                    </div>

                    {/* Info */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLotId(lot.id);
                        setCreatingLot(false);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-[9px] uppercase text-black/30" style={mono}>
                        LOT {String(idx + 1).padStart(2, "0")}
                      </p>
                      <p className="truncate text-[11px] text-black" style={mono}>
                        {lot.title}
                      </p>
                      {lot.startingBid != null && (
                        <p className="text-[9px] text-black/40" style={mono}>
                          STARTS {formatMoneyCents(lot.startingBid)}
                        </p>
                      )}
                    </button>

                    {/* Reorder buttons */}
                    {isDraft && (
                      <div className="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleReorder(lot.id, "up")}
                          className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-black/40 hover:bg-black/10 disabled:opacity-20"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === lots.length - 1}
                          onClick={() => handleReorder(lot.id, "down")}
                          className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-black/40 hover:bg-black/10 disabled:opacity-20"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lot editor panel */}
          <div className="flex-1 overflow-y-auto">
            {creatingLot ? (
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-[12px] uppercase tracking-widest text-black" style={mono}>
                    NEW LOT
                  </h2>
                </div>
                <LotEditor
                  auctionId={auction.id}
                  lot={null}
                  onSave={handleLotSaved}
                  onCancel={() => setCreatingLot(false)}
                />
              </div>
            ) : selectedLot ? (
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-[12px] uppercase tracking-widest text-black" style={mono}>
                    EDITING: {selectedLot.title}
                  </h2>
                </div>
                <LotEditor
                  key={selectedLot.id}
                  auctionId={auction.id}
                  lot={selectedLot}
                  onSave={handleLotSaved}
                  onCancel={() => setSelectedLotId(null)}
                  onDelete={isDraft ? handleLotDeleted : undefined}
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
                <p className="text-[12px] uppercase tracking-widest text-black/30" style={mono}>
                  {lots.length === 0 ? "ADD YOUR FIRST LOT" : "SELECT A LOT TO EDIT"}
                </p>
                {isDraft && lots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreatingLot(true)}
                    className="mt-4 text-[11px] uppercase tracking-widest text-black underline"
                    style={mono}
                  >
                    + ADD LOT
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
