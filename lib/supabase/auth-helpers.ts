const RECOVERABLE_SESSION_ERROR_CODES = new Set([
  "over_request_rate_limit",
  "refresh_token_already_used",
  "refresh_token_not_found",
  "session_expired",
  "session_not_found",
]);

export function isRecoverableSessionAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? error.code : undefined;
  return typeof code === "string" && RECOVERABLE_SESSION_ERROR_CODES.has(code);
}

export function getSupabaseAuthStorageKey(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const hostname = new URL(supabaseUrl).hostname;
    return `sb-${hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

export function isSupabaseAuthStorageCookie(name: string): boolean {
  const storageKey = getSupabaseAuthStorageKey();
  if (!storageKey) return false;

  return (
    name === storageKey ||
    name.startsWith(`${storageKey}.`) ||
    name === `${storageKey}-code-verifier` ||
    name.startsWith(`${storageKey}-code-verifier.`)
  );
}
