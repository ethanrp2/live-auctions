"use client";

import { useState } from "react";
import { ModalOverlay } from "@/components/storefront/modal-overlay";

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (question: string) => Promise<void> | void;
}

export function AskQuestionModal({
  isOpen,
  onClose,
  onSubmit,
}: AskQuestionModalProps) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fontMono = { fontFamily: "var(--storefront-font-mono)" };
  const fontDisplay = { fontFamily: "var(--storefront-font-display)" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send question");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      label="QUESTIONS"
      title="Ask a question"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[#5e5e5e]" style={fontDisplay}>
          The seller will receive and answer it live
        </p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something"
          rows={3}
          className="w-full rounded border border-[#bababa] bg-white p-3 text-sm text-black outline-none focus:border-black"
          style={fontDisplay}
        />
        {error && (
          <p className="text-xs text-[#dc2626]" style={fontMono}>
            {error}
          </p>
        )}
        <button
          type="submit"
          className="flex h-[50px] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={fontMono}
          disabled={submitting || question.trim().length === 0}
        >
          {submitting ? "SENDING…" : "SUBMIT"}
        </button>
      </form>
    </ModalOverlay>
  );
}
