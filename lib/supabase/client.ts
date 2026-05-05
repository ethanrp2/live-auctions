import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const cookieDomain = rootDomain === "localhost" ? undefined : `.${rootDomain}`;

export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: cookieDomain ? { domain: cookieDomain } : undefined,
  });
