"use client";

import type { AuctionQuestion } from "@/lib/hooks/use-auction-questions";

interface BuyerQuestionsFeedProps {
  questions: AuctionQuestion[];
  onDismiss: (id: string) => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(1, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds} SEC AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} MIN AGO`;
  return `${Math.floor(minutes / 60)} HR AGO`;
}

export function BuyerQuestionsFeed({
  questions,
  onDismiss,
}: BuyerQuestionsFeedProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span
          className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
          style={fontMono}
        >
          BUYER QUESTIONS
        </span>
        <span
          className="text-[10px] uppercase tracking-widest text-black"
          style={fontMono}
        >
          {questions.length}
        </span>
      </div>
      <div className="flex max-h-[180px] flex-col overflow-y-auto">
        {questions.length === 0 ? (
          <p
            className="px-4 py-3 text-center text-xs text-[#9c9c9c]"
            style={fontMono}
          >
            No questions yet.
          </p>
        ) : (
          questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-2 border-t border-[#f3f3f3] px-4 py-2"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-[9px] uppercase text-white" style={fontMono}>
                {q.user_id.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="truncate text-[11px] uppercase tracking-[-0.02em] text-black"
                    style={fontMono}
                  >
                    @{q.user_id.slice(0, 6)}
                  </span>
                  <span
                    className="shrink-0 text-[10px] uppercase tracking-widest text-[#9c9c9c]"
                    style={fontMono}
                  >
                    {relativeTime(q.created_at)}
                  </span>
                </div>
                <p
                  className="mt-0.5 text-xs leading-snug text-[#2a2a2a]"
                  style={fontDisplay}
                >
                  {q.question_text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(q.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9c9c9c] hover:bg-[#f3f3f3] hover:text-black"
                aria-label="Dismiss question"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
