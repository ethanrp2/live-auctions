"use client";

import { useEffect, useState } from "react";
import { formatMoneyCents, parseDollarsToCents } from "@/lib/format";
import { bidErrorMessage } from "@/lib/basta/client";
import { placeBidForLot } from "@/lib/basta/place-bid";
import { createClient } from "@/lib/supabase/client";

export interface LiveCustomBidSheetProps {
  isOpen: boolean;
  onClose: () => void;
  lotId: string;
  startingBidCents: number | null;
  minNextBidCents: number | null;
  onSubmitted: (amountCents: number) => void;
}

type SheetState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export function LiveCustomBidSheet({
  isOpen,
  onClose,
  lotId,
  startingBidCents,
  minNextBidCents,
  onSubmitted,
}: LiveCustomBidSheetProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<SheetState>({ status: "idle" });

  useEffect(() => {
    if (!isOpen) {
      setInput("");
      setState({ status: "idle" });
      return;
    }

    const defaultCents = minNextBidCents ?? startingBidCents;
    setInput(defaultCents != null ? (defaultCents / 100).toFixed(2) : "");
    setState({ status: "idle" });
  }, [isOpen, minNextBidCents, startingBidCents]);

  if (!isOpen) return null;

  const placeholderCents = minNextBidCents ?? startingBidCents;
  const placeholder =
    placeholderCents != null
      ? formatMoneyCents(placeholderCents).replace(/^\$/, "")
      : "";

  let parsedCents: number | null = null;
  let parseError: string | null = null;
  if (input.trim().length > 0) {
    try {
      parsedCents = parseDollarsToCents(input);
    } catch {
      parseError = "Enter a valid dollar amount.";
    }
  }

  const minimum = minNextBidCents ?? startingBidCents ?? 0;
  const meetsMinimum = parsedCents != null && parsedCents >= minimum;
  const submitting = state.status === "submitting";
  const canSubmit = !submitting && parsedCents != null && meetsMinimum;

  async function handleSubmit() {
    if (parsedCents == null) {
      setState({ status: "error", message: "Enter a valid dollar amount." });
      return;
    }
    if (!meetsMinimum) {
      setState({
        status: "error",
        message: `Bid must be at least ${formatMoneyCents(minimum)}.`,
      });
      return;
    }

    setState({ status: "submitting" });

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setState({
          status: "error",
          message: "You must be signed in to place a bid.",
        });
        return;
      }

      const result = await placeBidForLot({
        lotId,
        type: "NORMAL",
        amountCents: parsedCents,
        supabaseAccessToken: session.access_token,
      });

      if (!result.ok) {
        setState({
          status: "error",
          message: bidErrorMessage(result.errorCode, result.error),
        });
        return;
      }

      onSubmitted(result.amount);
      onClose();
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not place bid. Please try again.",
      });
    }
  }

  const ctaLabel =
    submitting
      ? "PLACING BID…"
      : parsedCents != null && meetsMinimum
        ? `CONFIRM BID ${formatMoneyCents(parsedCents)}`
        : "CONFIRM BID";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-xl flex-col gap-4 rounded-t-lg bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[-0.02em] text-black">
            CUSTOM BID
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e] transition-colors hover:text-black"
          >
            CANCEL
          </button>
        </div>

        {minimum > 0 && (
          <p className="text-xs text-[#5e5e5e]">
            Minimum bid: {formatMoneyCents(minimum)}
          </p>
        )}

        <div className="flex h-[50px] items-center gap-2.5 rounded-[2px] border border-[#bababa] px-4">
          <span className="text-sm tracking-[-0.02em] text-black">$</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (state.status === "error") setState({ status: "idle" });
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm tracking-[-0.02em] text-black outline-none placeholder:text-[#9c9c9c]"
            disabled={submitting}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex h-[50px] items-center justify-center rounded-[2px] bg-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <span className="text-sm uppercase tracking-[-0.02em] text-white">
            {ctaLabel}
          </span>
        </button>

        {(state.status === "error" || parseError) && (
          <p className="text-center text-xs text-[#c11]" role="alert">
            {state.status === "error" ? state.message : parseError}
          </p>
        )}
      </div>
    </div>
  );
}
