import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

function resolveNext(
  request: NextRequest,
  rawNext: string | null
): URL {
  const fallback = request.nextUrl.clone();
  fallback.pathname = "/";
  fallback.searchParams.delete("code");
  fallback.searchParams.delete("next");

  if (!rawNext) return fallback;

  // Absolute URL case: only honor it if the host is under our root domain
  // (so callbacks can hop back to a tenant subdomain, but attackers can't
  // redirect to an arbitrary host).
  if (/^https?:\/\//i.test(rawNext)) {
    try {
      const candidate = new URL(rawNext);
      const host = candidate.hostname;
      if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)) {
        return candidate;
      }
    } catch {
      // fall through to fallback
    }
    return fallback;
  }

  // Relative path case
  const url = request.nextUrl.clone();
  url.pathname = rawNext.startsWith("/") ? rawNext : `/${rawNext}`;
  url.searchParams.delete("code");
  url.searchParams.delete("next");
  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(resolveNext(request, next));
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}
