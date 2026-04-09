import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import { getTenantBySlug } from "@/lib/tenant";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/account", "/console"];
const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const baseDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

  // Extract subdomain
  let subdomain: string | null = null;
  if (hostname !== baseDomain && hostname.endsWith(baseDomain)) {
    subdomain = hostname.replace(`.${baseDomain}`, "");
  }

  // No subdomain or www → platform page
  if (!subdomain || subdomain === "www") {
    const { supabase, response } = createProxyClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Redirect logged-in users away from auth pages
    if (user && AUTH_PATHS.some((p) => pathname === p)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    const isProtected = PROTECTED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (isProtected && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
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
  const { supabase, response } = createProxyClient(request, {
    "x-tenant-id": tenant.id,
    "x-tenant-slug": tenant.slug,
    "x-tenant-name": tenant.name,
  });

  // Refresh auth session (updates cookies on response if needed)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect logged-in users away from auth pages
  if (user && AUTH_PATHS.some((p) => pathname === p)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // Check protected routes
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
