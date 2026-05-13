import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { getTenantBySlug } from "@/lib/tenant";
import { createServerClient } from "@supabase/ssr";
import { getSellerRedirectPathForUser } from "@/lib/seller-redirect";
import { isRecoverableSessionAuthError } from "@/lib/supabase/auth-helpers";

const PROTECTED_PATHS = ["/account", "/console"];
const AUTH_PATHS = ["/signup"];

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const baseDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isAuthPath = AUTH_PATHS.some((p) => pathname === p);
  const isLegacyLoginPath = pathname === "/login";

  // Extract subdomain
  let subdomain: string | null = null;
  if (hostname !== baseDomain && hostname.endsWith(baseDomain)) {
    subdomain = hostname.replace(`.${baseDomain}`, "");
  }

  // No subdomain or www → platform page
  if (!subdomain || subdomain === "www") {
    if (isLegacyLoginPath) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    if (!isProtected && !isAuthPath) {
      return NextResponse.next();
    }

    const { supabase, response, clearAuthCookies } = createProxyClient(request);
    let user = null;

    try {
      const {
        data: { user: resolvedUser },
      } = await supabase.auth.getUser();
      user = resolvedUser;
    } catch (error) {
      if (!isRecoverableSessionAuthError(error)) {
        console.warn("Failed to resolve auth user in proxy", error);
      }
      clearAuthCookies();
    }

    // Redirect logged-in users away from auth pages
    if (user && isAuthPath) {
      const homeUrl = request.nextUrl.clone();
      const sellerRedirect = await getSellerRedirectPathForUser({
        supabase,
        userId: user.id,
      });
      homeUrl.pathname = sellerRedirect ?? "/";
      return NextResponse.redirect(homeUrl);
    }

    if (isProtected && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/";
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Tenant lookup with a lightweight read-only Supabase client
  const lookupClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const tenant = await getTenantBySlug(lookupClient, subdomain);

  if (!tenant) {
    const url = request.nextUrl.clone();
    url.pathname = "/not-found";
    return NextResponse.rewrite(url);
  }

  // Create proxy client with tenant headers injected into the request
  const { supabase, response, clearAuthCookies } = createProxyClient(request, {
    "x-tenant-id": tenant.id,
    "x-tenant-slug": tenant.slug,
    "x-tenant-name": tenant.name,
  });

  if (isLegacyLoginPath) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  if (!isProtected && !isAuthPath) {
    return response;
  }

  let user = null;

  try {
    const {
      data: { user: resolvedUser },
    } = await supabase.auth.getUser();
    user = resolvedUser;
  } catch (error) {
    if (!isRecoverableSessionAuthError(error)) {
      console.warn("Failed to resolve tenant auth user in proxy", error);
    }
    clearAuthCookies();
  }

  // Redirect logged-in users away from auth pages
  if (user && isAuthPath) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
