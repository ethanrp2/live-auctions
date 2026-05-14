import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isSupabaseAuthStorageCookie } from "./auth-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const cookieDomain = rootDomain === "localhost" ? undefined : `.${rootDomain}`;

/**
 * Creates a Supabase client for use in proxy.ts with cookie sync.
 * Pass `extraRequestHeaders` to inject additional headers (e.g. tenant context)
 * into the forwarded request visible to downstream pages via `headers()`.
 */
export function createProxyClient(
  request: NextRequest,
  extraRequestHeaders?: Record<string, string>
) {
  function buildResponse() {
    const headers = new Headers(request.headers);
    if (extraRequestHeaders) {
      for (const [key, value] of Object.entries(extraRequestHeaders)) {
        headers.set(key, value);
      }
    }
    return NextResponse.next({ request: { headers } });
  }

  let supabaseResponse = buildResponse();

  const clearAuthCookies = () => {
    const authCookieNames = request.cookies
      .getAll()
      .map(({ name }) => name)
      .filter(isSupabaseAuthStorageCookie);

    authCookieNames.forEach((name) => request.cookies.delete(name));

    supabaseResponse = buildResponse();

    authCookieNames.forEach((name) =>
      supabaseResponse.cookies.set(name, "", {
        maxAge: 0,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      })
    );
  };

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = buildResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            ...(cookieDomain ? { domain: cookieDomain } : {}),
          })
        );
      },
    },
  });

  return {
    supabase,
    clearAuthCookies,
    get response() {
      return supabaseResponse;
    },
  };
}
