const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

let cached: { token: string; expiresAt: number } | null = null;

export async function getBastaToken(
  supabaseAccessToken: string
): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const res = await fetch(`${BACKEND_URL}/api/basta-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${supabaseAccessToken}` },
  });

  if (!res.ok) {
    throw new Error("Failed to get Basta token");
  }

  const data = await res.json();

  cached = {
    token: data.token,
    expiresAt: new Date(data.expiration).getTime(),
  };

  return cached.token;
}

export function invalidateBastaTokenCache(): void {
  cached = null;
}
