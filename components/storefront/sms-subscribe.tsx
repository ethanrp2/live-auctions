"use client";

import { useState } from "react";
import { isLightColor } from "@/lib/color";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface SmsSubscribeProps {
  variant: "desktop" | "mobile";
  primaryColor: string;
  tenantId: string;
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 11 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M1 3.5L4 6.5L10 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="14" rx="1" fill="#FFFFFF" />
      <rect y="0" width="20" height="1" fill="#B22234" />
      <rect y="2" width="20" height="1" fill="#B22234" />
      <rect y="4" width="20" height="1" fill="#B22234" />
      <rect y="6" width="20" height="1" fill="#B22234" />
      <rect y="8" width="20" height="1" fill="#B22234" />
      <rect y="10" width="20" height="1" fill="#B22234" />
      <rect y="12" width="20" height="1" fill="#B22234" />
      <rect width="8" height="7" fill="#3C3B6E" />
    </svg>
  );
}

export function SmsSubscribe({ variant, primaryColor, tenantId }: SmsSubscribeProps) {
  const [phone, setPhone] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  const buttonTextColor = isLightColor(primaryColor) ? "#000000" : "#ffffff";
  const isMobile = variant === "mobile";

  // Desktop: white card inline in hero
  // Mobile: dark fixed overlay at bottom
  const wrapperClasses = isMobile
    ? "fixed bottom-0 inset-x-0 z-40 lg:hidden"
    : "";

  const cardClasses = isMobile
    ? "flex w-full flex-col gap-5 overflow-hidden rounded-t-xl bg-black p-5"
    : "flex w-full flex-col gap-5 overflow-hidden rounded-md bg-white p-5";

  const labelColor = isMobile ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";
  const headingColor = isMobile ? "#ffffff" : "#000000";
  const closeColor = isMobile ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";
  const inputBg = isMobile ? "#f3f3f3" : "#f3f3f3";

  return (
    <div className={wrapperClasses}>
      <div className={cardClasses}>
        <div className="flex items-start justify-between gap-[30px]">
          <div className="flex flex-1 flex-col gap-1.5">
            <p
              className="text-xs uppercase tracking-[-0.02em] lg:text-sm"
              style={{
                fontFamily: "var(--storefront-font-mono)",
                color: labelColor,
              }}
            >
              {subscribed ? "YOU'RE ON THE LIST" : "SUBSCRIBE TO GET ALERTS"}
            </p>
            <p
              className="text-xl leading-tight lg:text-[22px]"
              style={{
                fontFamily: "var(--storefront-font-display)",
                color: headingColor,
              }}
            >
              {subscribed
                ? "We'll text you before it starts"
                : "Get text alerts for this auction"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 transition hover:opacity-70"
            style={{ color: closeColor }}
            aria-label="Dismiss"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </div>

        {subscribed ? (
          <div
            className="flex h-[50px] items-center justify-center gap-2.5 rounded"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckIcon
              className="h-2 w-[11px]"
              style={{ color: buttonTextColor }}
            />
            <span
              className="text-sm uppercase tracking-[-0.02em]"
              style={{
                fontFamily: "var(--storefront-font-mono)",
                color: buttonTextColor,
              }}
            >
              SUBSCRIBED
            </span>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const rawPhone = phone.trim();
              if (!rawPhone) return;
              // Normalise a 10-digit US number to E.164 if the user typed without +1
              const normalised = rawPhone.startsWith("+")
                ? rawPhone
                : `+1${rawPhone.replace(/\D/g, "")}`;
              setError(null);
              setLoading(true);
              try {
                const res = await fetch(`${BACKEND_URL}/api/buyer/sms-subscribe`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ phone: normalised, tenantId }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  setError((data as { error?: string }).error ?? "Failed to subscribe. Please try again.");
                } else {
                  setSubscribed(true);
                }
              } catch {
                setError("Network error. Please try again.");
              } finally {
                setLoading(false);
              }
            }}
            className="flex flex-col gap-2"
          >
            <div
              className="flex items-center justify-between rounded py-[5px] pl-4 pr-[5px]"
              style={{ backgroundColor: inputBg }}
            >
              <div className="flex flex-1 items-center gap-3">
                <UsFlagIcon className="h-[14px] w-5 shrink-0 rounded-sm" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(000) 000-0000"
                  className="w-full bg-transparent text-sm text-[#5e5e5e] outline-none placeholder:text-[#5e5e5e]"
                  style={{ fontFamily: "var(--storefront-font-display)" }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 shrink-0 items-center rounded px-5 text-sm uppercase tracking-[-0.02em] transition hover:opacity-90 disabled:opacity-60"
                style={{
                  fontFamily: "var(--storefront-font-mono)",
                  backgroundColor: primaryColor,
                  color: buttonTextColor,
                }}
              >
                {loading ? "..." : "SUBSCRIBE"}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-500" style={{ fontFamily: "var(--storefront-font-display)" }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
