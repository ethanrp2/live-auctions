"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ModalOverlay } from "./modal-overlay";
import { AccountPanel, type AccountPanelUser } from "./account-panel";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 14 17" fill="none" className="h-[17px] w-[14px]" aria-hidden="true">
      <path
        d="M13.3 13.18c-.31.72-.68 1.38-1.1 1.97-.57.81-1.04 1.37-1.4 1.68-.56.51-1.16.77-1.8.79-.46 0-1.01-.13-1.66-.4-.65-.26-1.25-.39-1.8-.39-.57 0-1.19.13-1.84.39-.66.27-1.19.41-1.59.43-.62.03-1.23-.24-1.83-.81-.39-.34-.88-.92-1.46-1.75C.25 14.23-.15 13.2-.15 12.2c0-1.15.25-2.14.74-2.96a4.36 4.36 0 013.62-2.16c.49 0 1.13.15 1.93.44.8.3 1.31.44 1.54.44.17 0 .74-.17 1.71-.5.91-.31 1.68-.44 2.31-.39 1.71.14 2.99.81 3.84 2.03-1.53.93-2.28 2.23-2.27 3.9.01 1.3.49 2.38 1.42 3.25.42.4.9.71 1.41.93-.11.33-.23.64-.36.94zM10.15.34c0 1.02-.37 1.97-1.11 2.84-.9 1.05-1.98 1.65-3.15 1.56a3.17 3.17 0 01-.02-.39c0-.98.43-2.03 1.19-2.88.38-.43.87-.79 1.46-1.07.59-.27 1.15-.43 1.68-.46.01.13.02.27.02.4h-.07z"
        fill="white"
      />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose, onComplete }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setCurrentUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();
        if (!cancelled) setProfile(data ?? null);
      } else {
        setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, supabase]);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onComplete();
    }
  };

  // If user is already signed in, render the Account panel instead of the
  // login form.
  if (currentUser) {
    const accountUser: AccountPanelUser = {
      id: currentUser.id,
      email: currentUser.email ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
    return <AccountPanel isOpen={isOpen} onClose={onClose} user={accountUser} />;
  }

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Heading */}
        <h2
          className="text-center text-sm uppercase tracking-[-0.02em] text-black"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          MUST BE SIGNED IN TO BID
        </h2>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="flex h-[50px] items-center justify-center gap-3 rounded border border-[#f3f3f3] bg-white text-sm transition-colors hover:bg-[#f8f8f8]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            <GoogleIcon />
            <span className="uppercase tracking-[-0.02em]">CONTINUE WITH GOOGLE</span>
          </button>
          <button
            type="button"
            className="flex h-[50px] items-center justify-center gap-3 rounded bg-black text-sm text-white transition-opacity hover:opacity-90"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            <AppleIcon />
            <span className="uppercase tracking-[-0.02em]">CONTINUE WITH APPLE</span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#f3f3f3]" />
          <span
            className="text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            OR
          </span>
          <div className="h-px flex-1 bg-[#f3f3f3]" />
        </div>

        {/* Email form */}
        <form onSubmit={handleContinue} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-[50px] w-full rounded border border-[#bababa] bg-white px-4 text-sm text-black outline-none placeholder:text-[#9c9c9c] focus:border-black"
              style={{ fontFamily: "var(--storefront-font-display)" }}
            />
          </div>
          <button
            type="submit"
            className="flex h-[50px] items-center justify-center rounded bg-black text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            CONTINUE
          </button>
        </form>

        {/* Legal */}
        <p
          className="text-center text-xs leading-relaxed text-[#9c9c9c]"
          style={{ fontFamily: "var(--storefront-font-display)" }}
        >
          By continuing, you agree to our{" "}
          <span className="underline">Terms of Service</span> and{" "}
          <span className="underline">Privacy Policy</span>.
        </p>
      </div>
    </ModalOverlay>
  );
}
