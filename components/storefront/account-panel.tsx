"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatMoneyCents } from "@/lib/format";
import { PaymentModal } from "./payment-modal";
import { ShippingModal } from "./shipping-modal";

export interface AccountPanelUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: AccountPanelUser | null;
}

interface OrderRow {
  id: string;
  sale_price: number | null;
  created_at: string | null;
  payment_status: string | null;
  shipping_status: string | null;
  tenant: { id: string; slug: string; name: string } | null;
  lot: { id: string; title: string | null } | null;
}

interface PaymentMethodSummary {
  id: string;
  brand: string | null;
  last4: string | null;
}

interface BuyerShippingAddress {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

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

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 8 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-2 text-[#5e5e5e]"
      aria-hidden="true"
    >
      <path
        d="M1 1L6 6L1 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatSoldDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Avatar({ user }: { user: AccountPanelUser }) {
  if (user.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  const initial = (user.display_name ?? user.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f3f3] text-sm uppercase text-black"
      style={{ fontFamily: "var(--storefront-font-mono)" }}
    >
      {initial}
    </div>
  );
}

export function AccountPanel({ isOpen, onClose, user }: AccountPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodSummary | null>(null);
  const [shippingSaved, setShippingSaved] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, sale_price, created_at, payment_status, shipping_status, tenant:tenants(id, slug, name), lot:lots(id, title)"
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return;
    const rows = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const flatten = (f: unknown) =>
        Array.isArray(f) ? (f[0] ?? null) : f ?? null;
      return {
        ...(r as Omit<OrderRow, "lot" | "tenant">),
        lot: flatten(r.lot) as OrderRow["lot"],
        tenant: flatten(r.tenant) as OrderRow["tenant"],
      } as OrderRow;
    });
    setOrders(rows);
  }, [supabase, user]);

  const loadPaymentMethod = useCallback(async () => {
    if (!user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`${BACKEND_URL}/api/buyer/payment-methods`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as { paymentMethods: PaymentMethodSummary[] };
      setPaymentMethod(json.paymentMethods?.[0] ?? null);
    } catch {
      // ignore — leave card display in last-known state
    }
  }, [supabase, user]);

  const loadShipping = useCallback(async () => {
    if (!user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`${BACKEND_URL}/api/buyer/profile`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        shippingAddress?: BuyerShippingAddress;
        hasSavedAddress?: boolean;
      };
      setShippingSaved(
        Boolean(
          json.hasSavedAddress ??
            json.shippingAddress?.street1 ??
            json.shippingAddress?.street2 ??
            json.shippingAddress?.city ??
            json.shippingAddress?.state ??
            json.shippingAddress?.postalCode
        )
      );
    } catch {
      // ignore — leave shipping summary in last-known state
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    void loadOrders();
    void loadPaymentMethod();
    void loadShipping();
  }, [isOpen, user, loadOrders, loadPaymentMethod, loadShipping]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  if (!isOpen || !user || typeof document === "undefined") return null;

  const paymentLabel = paymentMethod
    ? `${paymentMethod.brand?.toUpperCase() ?? "CARD"} ${paymentMethod.last4 ?? "----"}`
    : "Not saved";
  const shippingLabel = shippingSaved ? "1 saved" : "Not saved";
  const ordersLabel = `${orders.length} ITEM${orders.length === 1 ? "" : "S"}`;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[460px] flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f3f3f3] px-6 py-5">
          <div>
            <h2
              className="text-xl font-normal text-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            >
              Account
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              [ESC]
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-[#5e5e5e] hover:text-black"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3 px-6 py-5">
          <Avatar user={user} />
          <div className="flex flex-col">
            <span
              className="text-base text-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            >
              {user.display_name ?? "Buyer"}
            </span>
            <span
              className="text-sm text-[#5e5e5e]"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              {user.email ?? ""}
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Orders row */}
          <button
            type="button"
            onClick={() => setOrdersExpanded((v) => !v)}
            className="flex items-center justify-between border-t border-[#f3f3f3] px-6 py-5 text-left transition-colors hover:bg-[#fafafa]"
          >
            <span
              className="text-xs uppercase tracking-[-0.02em] text-black"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              ORDERS (WINS)
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                {ordersLabel}
              </span>
              <ChevronIcon />
            </div>
          </button>

          {ordersExpanded && (
            <div className="flex flex-col gap-2 bg-[#fafafa] px-6 py-3">
              {orders.length === 0 && (
                <p
                  className="text-sm text-[#5e5e5e]"
                  style={{ fontFamily: "var(--storefront-font-display)" }}
                >
                  No orders yet.
                </p>
              )}
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start justify-between rounded border border-[#f3f3f3] bg-white px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="text-sm text-black"
                      style={{ fontFamily: "var(--storefront-font-display)" }}
                    >
                      {order.lot?.title ?? "Lot"}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-widest text-[#5e5e5e]"
                      style={{ fontFamily: "var(--storefront-font-mono)" }}
                    >
                      {order.tenant?.name ?? ""}{order.tenant ? " · " : ""}{formatSoldDate(order.created_at)}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-widest"
                      style={{
                        fontFamily: "var(--storefront-font-mono)",
                        color: order.payment_status === "paid" ? "#22c55e" : "#f59e0b",
                      }}
                    >
                      {order.payment_status?.toUpperCase() ?? "PENDING"}
                    </span>
                  </div>
                  <span
                    className="text-sm text-black"
                    style={{ fontFamily: "var(--storefront-font-mono)" }}
                  >
                    {formatMoneyCents(order.sale_price)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Payment row */}
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center justify-between border-t border-[#f3f3f3] px-6 py-5 text-left transition-colors hover:bg-[#fafafa]"
          >
            <span
              className="text-xs uppercase tracking-[-0.02em] text-black"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              PAYMENT METHOD
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                {paymentLabel}
              </span>
              <ChevronIcon />
            </div>
          </button>

          {/* Shipping row */}
          <button
            type="button"
            onClick={() => setShowShippingModal(true)}
            className="flex items-center justify-between border-t border-b border-[#f3f3f3] px-6 py-5 text-left transition-colors hover:bg-[#fafafa]"
          >
            <span
              className="text-xs uppercase tracking-[-0.02em] text-black"
              style={{ fontFamily: "var(--storefront-font-mono)" }}
            >
              SHIPPING ADDRESS
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
                style={{ fontFamily: "var(--storefront-font-mono)" }}
              >
                {shippingLabel}
              </span>
              <ChevronIcon />
            </div>
          </button>
        </div>

        {/* Logout */}
        <div className="border-t border-[#f3f3f3] px-6 py-5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-[50px] w-full items-center justify-center rounded border border-red-500 text-sm uppercase tracking-[-0.02em] text-red-600 transition-colors hover:bg-red-50"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            LOGOUT
          </button>
        </div>
      </aside>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          void loadPaymentMethod();
        }}
        onComplete={() => {
          setShowPaymentModal(false);
          void loadPaymentMethod();
        }}
      />
      <ShippingModal
        isOpen={showShippingModal}
        onClose={() => {
          setShowShippingModal(false);
          void loadShipping();
        }}
        onComplete={() => {
          setShowShippingModal(false);
          void loadShipping();
        }}
      />
    </>,
    document.body
  );
}
