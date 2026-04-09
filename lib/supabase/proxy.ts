import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const cookieDomain = `.${rootDomain}`;

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
            domain: cookieDomain,
          })
        );
      },
    },
  });

  return {
    supabase,
    get response() {
      return supabaseResponse;
    },
  };
}
