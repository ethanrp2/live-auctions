import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const cookieDomain = rootDomain === "localhost" ? rootDomain : `.${rootDomain}`;

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              domain: cookieDomain,
            })
          );
        } catch {
          // Called from a Server Component — cannot set cookies.
        }
      },
    },
  });
};
