"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoneyCents } from "@/lib/format";
import type { User } from "@supabase/supabase-js";

interface PlatformHomeProps {
  user: User | null;
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LoggedInDashboard({ user }: { user: User }) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profileResult, ordersResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle<{ display_name: string | null }>(),
      supabase
        .from("orders")
        .select(
          "id, sale_price, created_at, payment_status, shipping_status, tenant:tenants(id, slug, name), lot:lots(id, title)"
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setDisplayName(profileResult.data?.display_name ?? null);

    const rows = (ordersResult.data ?? []).map((row) => {
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
    setLoading(false);
  }, [supabase, user.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const name = displayName ?? user.email?.split("@")[0] ?? "Buyer";

  const ordersByTenant = orders.reduce<Record<string, { tenantName: string; tenantSlug: string; items: OrderRow[] }>>((acc, o) => {
    const key = o.tenant?.slug ?? "unknown";
    if (!acc[key]) {
      acc[key] = { tenantName: o.tenant?.name ?? key, tenantSlug: key, items: [] };
    }
    acc[key].items.push(o);
    return acc;
  }, {});

  return (
    <div
      className="flex min-h-screen flex-col bg-white"
      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      {/* Top bar */}
      <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-[#f3f3f3] px-6">
        <span className="text-[11px] uppercase tracking-widest text-black/40">
          LIVE AUCTIONS — PLATFORM
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="text-[11px] uppercase tracking-widest text-black/40 transition-colors hover:text-black"
        >
          LOGOUT
        </button>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-[22px] font-normal text-black">
            Welcome back, {name}
          </h1>
          <p className="mt-1 text-[12px] uppercase tracking-widest text-black/40">
            {user.email}
          </p>
        </div>

        {/* Orders across all houses */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-widest text-black">
              YOUR WINS — ALL HOUSES
            </h2>
            <span className="text-[11px] uppercase tracking-widest text-black/40">
              {orders.length} TOTAL
            </span>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <span className="text-[11px] uppercase tracking-widest text-black/30">
                LOADING...
              </span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[4px] border border-dashed border-[#e5e5e5] py-16 text-center">
              <p className="text-[12px] uppercase tracking-widest text-black/40">
                NO WINS YET
              </p>
              <p className="mt-2 text-[11px] text-black/30">
                Bid on lots across any auction house to see your wins here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(ordersByTenant).map(([slug, group]) => (
                <div key={slug}>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-black/60">
                      {group.tenantName}
                    </span>
                    <a
                      href={`http://${group.tenantSlug}.localhost:3000`}
                      className="text-[10px] uppercase tracking-widest text-black/30 underline hover:text-black"
                    >
                      VISIT →
                    </a>
                  </div>
                  <div className="overflow-hidden rounded-[4px] border border-[#f3f3f3]">
                    <div className="grid grid-cols-[1fr_120px_80px_90px] gap-3 border-b border-[#f3f3f3] bg-[#fafafa] px-4 py-2 text-[10px] uppercase tracking-widest text-black/40">
                      <span>LOT</span>
                      <span>DATE</span>
                      <span className="text-right">PRICE</span>
                      <span className="text-right">STATUS</span>
                    </div>
                    {group.items.map((order) => (
                      <div
                        key={order.id}
                        className="grid grid-cols-[1fr_120px_80px_90px] items-center gap-3 border-b border-[#f3f3f3] px-4 py-3 last:border-b-0"
                      >
                        <span className="truncate text-[13px] text-black">
                          {order.lot?.title ?? "Lot"}
                        </span>
                        <span className="text-[11px] text-black/40">
                          {formatDate(order.created_at)}
                        </span>
                        <span className="text-right text-[12px] tabular-nums text-black">
                          {formatMoneyCents(order.sale_price)}
                        </span>
                        <span
                          className="text-right text-[10px] uppercase tracking-widest"
                          style={{
                            color:
                              order.payment_status === "paid"
                                ? "#22c55e"
                                : "#f59e0b",
                          }}
                        >
                          {order.payment_status ?? "PENDING"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links to auction houses */}
        <div className="mt-12 border-t border-[#f3f3f3] pt-8">
          <h2 className="mb-4 text-[11px] uppercase tracking-widest text-black/40">
            AUCTION HOUSES
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { slug: "basa", name: "BASA" },
              { slug: "unsoundrags", name: "UNSOUND RAGS" },
            ].map((h) => (
              <a
                key={h.slug}
                href={`http://${h.slug}.localhost:3000`}
                className="inline-flex h-[40px] items-center rounded-[4px] border border-[#f3f3f3] px-4 text-[11px] uppercase tracking-widest text-black transition-colors hover:border-black"
              >
                {h.name} →
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "magic">("password");

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8">
        <h1
          className="text-[28px] font-normal tracking-tight text-black"
          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
        >
          LIVE AUCTIONS
        </h1>
        <p className="mt-1 text-[12px] uppercase tracking-widest text-black/40">
          Real-time auctions for independent houses
        </p>
      </div>

      {magicSent ? (
        <div className="rounded-[4px] border border-[#f3f3f3] bg-[#fafafa] p-6 text-center">
          <p className="text-[12px] uppercase tracking-widest text-black/60">
            MAGIC LINK SENT
          </p>
          <p className="mt-2 text-[12px] text-black/40">
            Check {email} and click the link to sign in.
          </p>
          <button
            type="button"
            onClick={() => { setMagicSent(false); setEmail(""); }}
            className="mt-4 text-[11px] uppercase tracking-widest text-black/40 underline hover:text-black"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          {/* Auth method toggle */}
          <div className="mb-5 flex rounded-[4px] border border-[#f3f3f3]">
            {(["password", "magic"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAuthMethod(m)}
                className={`flex-1 py-2 text-[11px] uppercase tracking-widest transition-colors ${
                  authMethod === m
                    ? "bg-black text-white"
                    : "bg-white text-black/40 hover:text-black"
                }`}
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                {m === "password" ? "PASSWORD" : "MAGIC LINK"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-[4px] border border-[#ff0004]/30 bg-[#ff0004]/5 px-3 py-2 text-[11px] text-[#ff0004]">
              {error}
            </div>
          )}

          <form
            onSubmit={authMethod === "magic" ? handleMagicLink : handlePasswordAuth}
            className="flex flex-col gap-3"
          >
            <div>
              <label
                className="mb-1 block text-[11px] uppercase tracking-widest text-black/40"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-[50px] w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[13px] text-black focus:border-black focus:outline-none"
              />
            </div>

            {authMethod === "password" && (
              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-widest text-black/40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[50px] w-full rounded-[4px] border border-[#f3f3f3] bg-white px-3 text-[13px] text-black focus:border-black focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-[50px] w-full rounded-[4px] bg-black text-[12px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {loading
                ? "..."
                : authMethod === "magic"
                ? "SEND MAGIC LINK"
                : mode === "signup"
                ? "CREATE ACCOUNT"
                : "SIGN IN"}
            </button>
          </form>

          {authMethod === "password" && (
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
              className="mt-4 w-full text-center text-[11px] uppercase tracking-widest text-black/40 hover:text-black"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {mode === "login" ? "NO ACCOUNT? CREATE ONE →" : "HAVE AN ACCOUNT? SIGN IN →"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function PlatformHome({ user: initialUser }: PlatformHomeProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  if (user) {
    return <LoggedInDashboard user={user} />;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-white px-4">
      <LoginForm onSuccess={() => window.location.reload()} />
    </div>
  );
}
