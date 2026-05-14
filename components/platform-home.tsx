"use client";

import { useState, useEffect, useMemo } from "react";
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

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

function houseUrl(slug: string): string {
  if (typeof window === "undefined") {
    return `http://${slug}.${ROOT_DOMAIN}:3000`;
  }
  const port = window.location.port ? `:${window.location.port}` : "";
  return `${window.location.protocol}//${slug}.${ROOT_DOMAIN}${port}`;
}

function sellerManagerUrl(slug: string): string {
  return `${houseUrl(slug)}/seller/auctions`;
}

function withLocalSessionHash(url: string, session: {
  access_token: string;
  refresh_token: string;
} | null): string {
  if (ROOT_DOMAIN !== "localhost" || !session) return url;
  const payload = btoa(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
  );
  return `${url}#la_session=${payload}`;
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

  useEffect(() => {
    let active = true;

    void Promise.all([
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
    ]).then(([profileResult, ordersResult]) => {
      if (!active) return;

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
    });

    return () => {
      active = false;
    };
  }, [supabase, user.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  const handleHouseVisit = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    slug: string
  ) => {
    event.preventDefault();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    window.location.assign(withLocalSessionHash(houseUrl(slug), session));
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
      className="flex min-h-screen flex-col bg-[#f7f7f5] text-black"
      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      <header className="flex h-[58px] shrink-0 items-center justify-between border-b border-black/10 bg-white px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 bg-[#ff0004]" />
          <span className="text-[11px] uppercase tracking-widest text-black/45">
            LIVE AUCTIONS PLATFORM
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="h-[34px] border border-black/10 bg-white px-3 text-[10px] uppercase tracking-widest text-black/50 transition-colors hover:border-black hover:text-black"
        >
          LOGOUT
        </button>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[300px_1fr] lg:py-12">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="mb-4 text-[10px] uppercase tracking-[0.24em] text-black/35">
            Buyer Account
          </p>
          <h1
            className="max-w-[9ch] text-[42px] font-normal leading-[0.95] tracking-normal text-black sm:text-[52px]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Welcome back, {name}
          </h1>
          <p className="mt-5 break-all text-[12px] leading-5 text-black/45">
            {user.email}
          </p>
          <div className="mt-8 grid grid-cols-2 border-y border-black/10">
            <div className="border-r border-black/10 py-4 pr-4">
              <p className="text-[24px] leading-none tabular-nums">
                {orders.length}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-black/35">
                Wins
              </p>
            </div>
            <div className="py-4 pl-4">
              <p className="text-[24px] leading-none tabular-nums">
                {Object.keys(ordersByTenant).length}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-black/35">
                Houses
              </p>
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#ff0004]">
                Unified Orders
              </p>
              <h2 className="mt-2 text-[16px] uppercase tracking-widest text-black">
                All House Wins
              </h2>
            </div>
            <span className="text-[11px] uppercase tracking-widest text-black/40">
              {orders.length} Total
            </span>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center border border-black/10 bg-white">
              <span className="text-[11px] uppercase tracking-widest text-black/30">
                Loading orders
              </span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex min-h-[260px] flex-col justify-center border border-dashed border-black/15 bg-white px-6 py-12">
              <p className="text-[13px] uppercase tracking-widest text-black/55">
                No wins yet
              </p>
              <p
                className="mt-3 max-w-sm text-[14px] leading-6 text-black/45"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                Bid on lots across any auction house to see your wins here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {Object.entries(ordersByTenant).map(([slug, group]) => (
                <div key={slug}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[12px] uppercase tracking-widest text-black/65">
                      {group.tenantName}
                    </span>
                    <a
                      href={houseUrl(group.tenantSlug)}
                      onClick={(event) => handleHouseVisit(event, group.tenantSlug)}
                      className="border-b border-black/20 pb-0.5 text-[10px] uppercase tracking-widest text-black/35 transition-colors hover:border-black hover:text-black"
                    >
                      Visit House
                    </a>
                  </div>
                  <div className="overflow-x-auto border border-black/10 bg-white">
                    <div className="grid min-w-[620px] grid-cols-[1fr_120px_100px_110px] gap-4 border-b border-black/10 bg-[#fbfbfa] px-4 py-3 text-[10px] uppercase tracking-widest text-black/35">
                      <span>LOT</span>
                      <span>DATE</span>
                      <span className="text-right">PRICE</span>
                      <span className="text-right">STATUS</span>
                    </div>
                    {group.items.map((order) => (
                      <div
                        key={order.id}
                        className="grid min-w-[620px] grid-cols-[1fr_120px_100px_110px] items-center gap-4 border-b border-black/10 px-4 py-4 transition-colors last:border-b-0 hover:bg-[#fbfbfa]"
                      >
                        <span
                          className="truncate text-[14px] text-black"
                          style={{ fontFamily: "var(--font-inter)" }}
                        >
                          {order.lot?.title ?? "Lot"}
                        </span>
                        <span className="text-[11px] text-black/40">
                          {formatDate(order.created_at)}
                        </span>
                        <span className="text-right text-[13px] tabular-nums text-black">
                          {formatMoneyCents(order.sale_price)}
                        </span>
                        <span
                          className="text-right text-[10px] uppercase tracking-widest"
                          style={{
                            color:
                              order.payment_status === "paid"
                                ? "#111111"
                                : "#ff0004",
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

        <div className="mt-10 border-t border-black/10 pt-6">
          <h2 className="mb-4 text-[11px] uppercase tracking-widest text-black/40">
            Auction Houses
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { slug: "basa", name: "BASA" },
              { slug: "unsoundrags", name: "UNSOUND RAGS" },
            ].map((h) => (
              <a
                key={h.slug}
                href={houseUrl(h.slug)}
                onClick={(event) => handleHouseVisit(event, h.slug)}
                className="inline-flex h-[42px] items-center border border-black/10 bg-white px-4 text-[11px] uppercase tracking-widest text-black/65 transition-colors hover:border-black hover:text-black"
              >
                {h.name}
              </a>
            ))}
          </div>
        </div>
        </section>
      </main>
    </div>
  );
}

function LoginForm({
  onSuccess,
  onAuthRoutingChange,
}: {
  onSuccess: () => void;
  onAuthRoutingChange: (isRouting: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "magic">("password");
  const [accountRole, setAccountRole] = useState<"buyer" | "seller">("buyer");

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    onAuthRoutingChange(true);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (accountRole === "seller") {
          throw new Error("Seller accounts are assigned from a house.");
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("Check your email to confirm your account.");
        onAuthRoutingChange(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const userId = data.user?.id;
        if (!userId) throw new Error("Sign in did not return a user.");

        const { data: profile } = await supabase
          .from("profiles")
          .select("is_seller, tenant_id")
          .eq("id", userId)
          .maybeSingle<{ is_seller: boolean | null; tenant_id: string | null }>();
        const isSeller = Boolean(profile?.is_seller && profile.tenant_id);

        if (accountRole === "buyer" && isSeller) {
          await supabase.auth.signOut({ scope: "local" });
          throw new Error("Use Seller Sign In for this account.");
        }

        if (accountRole === "seller") {
          if (!isSeller || !profile?.tenant_id) {
            await supabase.auth.signOut({ scope: "local" });
            throw new Error("Seller access required for this account.");
          }

          const { data: tenant } = await supabase
            .from("tenants")
            .select("slug")
            .eq("id", profile.tenant_id)
            .maybeSingle<{ slug: string }>();
          if (!tenant?.slug) {
            await supabase.auth.signOut({ scope: "local" });
            throw new Error("Seller house could not be found.");
          }

          window.location.assign(withLocalSessionHash(sellerManagerUrl(tenant.slug), data.session));
          return;
        }

        const next = new URLSearchParams(window.location.search).get("next");
        if (next) {
          window.location.assign(withLocalSessionHash(next, data.session));
          return;
        }
        onAuthRoutingChange(false);
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      onAuthRoutingChange(false);
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
    <div className="w-full max-w-[430px]">
      <div className="mb-9 border-b border-black/10 pb-7">
        <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-[#ff0004]">
          {accountRole === "buyer" ? "Buyer Access" : "Seller Access"}
        </p>
        <h1
          className="text-[56px] font-normal leading-[0.9] tracking-normal text-black"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Live Auctions
        </h1>
        <p
          className="mt-5 max-w-[33ch] text-[14px] leading-6 text-black/50"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {accountRole === "buyer"
            ? "Sign in once to bid and review orders across every participating house."
            : "Sign in to manage your assigned auction house."}
        </p>
      </div>

      {magicSent ? (
        <div className="border border-black/10 bg-white p-6">
          <p className="text-[12px] uppercase tracking-widest text-black/70">
            Magic link sent
          </p>
          <p
            className="mt-3 text-[13px] leading-6 text-black/45"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Check {email} and click the link to sign in.
          </p>
          <button
            type="button"
            onClick={() => { setMagicSent(false); setEmail(""); }}
            className="mt-6 border-b border-black/20 pb-0.5 text-[11px] uppercase tracking-widest text-black/45 transition-colors hover:border-black hover:text-black"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 border border-black/10 bg-white">
            {(["buyer", "seller"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setAccountRole(role);
                  setMode("login");
                  setError(null);
                }}
                className={`h-[44px] text-[11px] uppercase tracking-widest transition-colors ${
                  accountRole === role
                    ? "bg-black text-white"
                    : "bg-white text-black/45 hover:text-black"
                }`}
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-2 border border-black/10 bg-white">
            {(["password", "magic"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAuthMethod(m)}
                className={`h-[44px] text-[11px] uppercase tracking-widest transition-colors ${
                  authMethod === m
                    ? "bg-black text-white"
                    : "bg-white text-black/45 hover:text-black"
                }`}
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                {m === "password" ? "Password" : "Magic Link"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 border border-[#ff0004]/30 bg-white px-3 py-3 text-[12px] leading-5 text-[#ff0004]">
              {error}
            </div>
          )}

          <form
            onSubmit={authMethod === "magic" ? handleMagicLink : handlePasswordAuth}
            className="flex flex-col gap-3"
          >
            <div>
              <label
                className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-black/40"
                style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-[52px] w-full border border-black/10 bg-white px-3 text-[14px] text-black transition-colors focus:border-black focus:outline-none"
                style={{ fontFamily: "var(--font-inter)" }}
              />
            </div>

            {authMethod === "password" && (
              <div>
                <label
                  className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-black/40"
                  style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[52px] w-full border border-black/10 bg-white px-3 text-[14px] text-black transition-colors focus:border-black focus:outline-none"
                  style={{ fontFamily: "var(--font-inter)" }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-[52px] w-full bg-black text-[12px] uppercase tracking-widest text-white transition-colors hover:bg-[#ff0004] disabled:bg-black/40"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {loading
                ? "Working"
                : authMethod === "magic"
                ? "Send Magic Link"
                : mode === "signup"
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          {authMethod === "password" && accountRole === "buyer" && (
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
              className="mt-5 w-full text-center text-[11px] uppercase tracking-widest text-black/40 transition-colors hover:text-black"
              style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
            >
              {mode === "login" ? "No account? Create one" : "Have an account? Sign in"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function PlatformHome({ user: initialUser }: PlatformHomeProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [authRouting, setAuthRouting] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? initialUser);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        return;
      }

      void supabase.auth.getUser().then(({ data }) => {
        setUser(data.user ?? null);
      });
    });
    return () => subscription.unsubscribe();
  }, [initialUser, supabase]);

  if (user && !authRouting) {
    return <LoggedInDashboard user={user} />;
  }

  return (
    <div
      className="grid min-h-screen bg-[#f7f7f5] text-black lg:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]"
      style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
    >
      <section className="flex min-h-[42vh] flex-col justify-between border-b border-black/10 bg-black px-6 py-6 text-white sm:px-8 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] uppercase tracking-[0.28em] text-white/45">
            Platform
          </span>
          <span className="h-2 w-2 bg-[#ff0004]" />
        </div>
        <div className="py-12 lg:py-0">
          <p className="mb-5 text-[10px] uppercase tracking-[0.28em] text-white/35">
            Unified Buyer Desk
          </p>
          <h2
            className="max-w-[8ch] text-[64px] font-normal leading-[0.88] tracking-normal text-white sm:text-[82px] lg:text-[96px]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Bid across houses.
          </h2>
        </div>
        <div className="grid grid-cols-2 border-y border-white/15">
          <div className="border-r border-white/15 py-4 pr-4">
            <p className="text-[10px] uppercase tracking-widest text-white/35">
              Session
            </p>
            <p className="mt-2 text-[12px] uppercase tracking-widest text-white/70">
              Shared
            </p>
          </div>
          <div className="py-4 pl-4">
            <p className="text-[10px] uppercase tracking-widest text-white/35">
              Orders
            </p>
            <p className="mt-2 text-[12px] uppercase tracking-widest text-white/70">
              Unified
            </p>
          </div>
        </div>
      </section>
      <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:py-16">
        <LoginForm
          onSuccess={() => window.location.reload()}
          onAuthRoutingChange={setAuthRouting}
        />
      </main>
    </div>
  );
}
