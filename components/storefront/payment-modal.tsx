"use client";

// NOTE: This component depends on `@stripe/stripe-js` and
// `@stripe/react-stripe-js`, which are NOT yet listed in the root
// package.json. Install with:
//   pnpm add @stripe/stripe-js @stripe/react-stripe-js
// The component is written assuming both packages will be available.
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeClient } from "@stripe/stripe-js";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ModalOverlay } from "./modal-overlay";
import { createClient } from "@/lib/supabase/client";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export interface SavedPaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let stripePromise: Promise<StripeClient | null> | null = null;
function getStripe(): Promise<StripeClient | null> {
  if (stripePromise) return stripePromise;
  const next = STRIPE_PUBLISHABLE_KEY
    ? loadStripe(STRIPE_PUBLISHABLE_KEY)
    : (Promise.resolve(null) as Promise<StripeClient | null>);
  stripePromise = next;
  return next;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function fetchPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const headers = await getAuthHeader();
  const res = await fetch(`${BACKEND_URL}/api/buyer/payment-methods`, {
    headers,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { paymentMethods: SavedPaymentMethod[] };
  return json.paymentMethods ?? [];
}

export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<boolean> {
  const headers = await getAuthHeader();
  const res = await fetch(`${BACKEND_URL}/api/buyer/detach-payment-method`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentMethodId }),
  });
  return res.ok;
}

async function createSetupIntent(): Promise<string | null> {
  const headers = await getAuthHeader();
  const res = await fetch(`${BACKEND_URL}/api/buyer/setup-intent`, {
    method: "POST",
    headers,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { clientSecret: string | null };
  return json.clientSecret;
}

interface CardFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function CardForm({ clientSecret, onSuccess, onError }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setSubmitting(true);
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardElement },
    });
    setSubmitting(false);

    if (result.error) {
      onError(result.error.message ?? "Failed to save card");
      return;
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="rounded border border-[#bababa] bg-white p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "14px",
                color: "#000",
                "::placeholder": { color: "#9c9c9c" },
              },
            },
          }}
        />
      </div>
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="flex h-[50px] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {submitting ? "SAVING..." : "SAVE CARD"}
      </button>
    </form>
  );
}

export function PaymentModal({ isOpen, onClose, onComplete }: PaymentModalProps) {
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const methods = await fetchPaymentMethods();
      setSavedMethods(methods);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setAdding(false);
    setClientSecret(null);
    void refresh();
  }, [isOpen, refresh]);

  const handleAddCard = async () => {
    setError(null);
    const secret = await createSetupIntent();
    if (!secret) {
      setError("Failed to start card setup");
      return;
    }
    setClientSecret(secret);
    setAdding(true);
  };

  const handleDelete = async (paymentMethodId: string) => {
    const ok = await detachPaymentMethod(paymentMethodId);
    if (ok) {
      await refresh();
    } else {
      setError("Failed to remove card");
    }
  };

  const handleSaveSuccess = async () => {
    setAdding(false);
    setClientSecret(null);
    await refresh();
    onComplete();
  };

  const stripe = useMemo(() => getStripe(), []);

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            REQUIRED
          </span>
          <h2
            className="text-xl font-normal text-black"
            style={{ fontFamily: "var(--storefront-font-display)" }}
          >
            Payment method
          </h2>
        </div>

        {error && (
          <div
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            {error}
          </div>
        )}

        {!adding && (
          <div className="flex flex-col gap-3">
            {loading && (
              <p
                className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                LOADING...
              </p>
            )}

            {!loading && savedMethods.length === 0 && (
              <p
                className="text-sm text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-display)" }}
              >
                No card saved yet.
              </p>
            )}

            {!loading &&
              savedMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between rounded border border-[#bababa] bg-white px-4 py-3"
                >
                  <span
                    className="text-sm uppercase tracking-[-0.02em] text-black"
                    style={{ fontFamily: "var(--storefront-font-mono)" }}
                  >
                    {pm.brand?.toUpperCase() ?? "CARD"} •••• {pm.last4 ?? "----"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(pm.id)}
                    className="text-xs uppercase tracking-[-0.02em] text-red-600 hover:underline"
                    style={{ fontFamily: "var(--storefront-font-mono)" }}
                  >
                    REMOVE
                  </button>
                </div>
              ))}

            <button
              type="button"
              onClick={handleAddCard}
              className="flex h-[50px] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              ADD CARD
            </button>
          </div>
        )}

        {adding && clientSecret && (
          <Elements stripe={stripe} options={{ clientSecret }}>
            <CardForm
              clientSecret={clientSecret}
              onSuccess={handleSaveSuccess}
              onError={(msg) => setError(msg)}
            />
          </Elements>
        )}
      </div>
    </ModalOverlay>
  );
}
