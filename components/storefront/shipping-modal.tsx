"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ModalOverlay } from "./modal-overlay";

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onBack?: () => void;
}

interface BuyerShippingAddress {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

const EMPTY_ADDRESS: BuyerShippingAddress = {
  street1: "",
  street2: "",
  city: "",
  state: "",
  postalCode: "",
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

async function getAuthHeader() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  return { Authorization: `Bearer ${session.access_token}` };
}

export function ShippingModal({
  isOpen,
  onClose,
  onComplete,
  onBack,
}: ShippingModalProps) {
  const [address, setAddress] = useState<BuyerShippingAddress>(EMPTY_ADDRESS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () =>
      Boolean(
        address.street1?.trim() &&
          address.city?.trim() &&
          address.state?.trim() &&
          address.postalCode?.trim()
      ),
    [address]
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeader();
        if (!headers) {
          if (!cancelled) {
            setAddress(EMPTY_ADDRESS);
            setError("Sign in again to update your shipping address.");
          }
          return;
        }

        const res = await fetch(`${BACKEND_URL}/api/buyer/profile`, {
          headers,
        });

        if (!res.ok) {
          throw new Error("Failed to load profile");
        }

        const json = (await res.json()) as {
          shippingAddress?: BuyerShippingAddress;
        };

        if (!cancelled) {
          setAddress({
            street1: json.shippingAddress?.street1 ?? "",
            street2: json.shippingAddress?.street2 ?? "",
            city: json.shippingAddress?.city ?? "",
            state: json.shippingAddress?.state ?? "",
            postalCode: json.shippingAddress?.postalCode ?? "",
          });
        }
      } catch {
        if (!cancelled) {
          setAddress(EMPTY_ADDRESS);
          setError("Failed to load shipping address.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;

    void (async () => {
      setSaving(true);
      setError(null);

      try {
        const headers = await getAuthHeader();
        if (!headers) {
          setError("Sign in again to update your shipping address.");
          return;
        }

        const res = await fetch(`${BACKEND_URL}/api/buyer/profile`, {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shippingAddress: {
              street1: address.street1 ?? "",
              street2: address.street2 ?? "",
              city: address.city ?? "",
              state: address.state ?? "",
              postalCode: address.postalCode ?? "",
            },
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to save profile");
        }

        onComplete();
      } catch {
        setError("Failed to save shipping address.");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} variant="centered">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span
              className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              SHIPPING
            </span>
            <h2
              className="text-xl font-normal text-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            >
              Shipping address
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5e5e5e] transition-colors hover:text-black"
            aria-label="Close shipping modal"
          >
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={address.street1 ?? ""}
            onChange={(e) =>
              setAddress((current) => ({ ...current, street1: e.target.value }))
            }
            placeholder="Street address"
            disabled={loading || saving}
            className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black disabled:opacity-60"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <input
            type="text"
            value={address.street2 ?? ""}
            onChange={(e) =>
              setAddress((current) => ({ ...current, street2: e.target.value }))
            }
            placeholder="Address line 2"
            disabled={loading || saving}
            className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black disabled:opacity-60"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <input
            type="text"
            value={address.city ?? ""}
            onChange={(e) =>
              setAddress((current) => ({ ...current, city: e.target.value }))
            }
            placeholder="City"
            disabled={loading || saving}
            className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black disabled:opacity-60"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          />
          <div className="flex gap-3">
            <input
              type="text"
              value={address.state ?? ""}
              onChange={(e) =>
                setAddress((current) => ({ ...current, state: e.target.value }))
              }
              placeholder="State"
              disabled={loading || saving}
              className="h-[50px] flex-1 rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black disabled:opacity-60"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            />
            <input
              type="text"
              value={address.postalCode ?? ""}
              onChange={(e) =>
                setAddress((current) => ({
                  ...current,
                  postalCode: e.target.value,
                }))
              }
              placeholder="Zip code"
              disabled={loading || saving}
              className="h-[50px] flex-1 rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black disabled:opacity-60"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-[50px] flex-1 items-center justify-center rounded border border-black text-sm uppercase tracking-[-0.02em] text-black transition-colors hover:bg-[#f8f8f8]"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              BACK
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!canSave || loading || saving}
            className="flex h-[50px] flex-1 items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            {saving ? "SAVING..." : "SAVE AND FINISH"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
