const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface DisplayNameResponse {
  profiles?: Array<{
    id: string;
    displayName: string | null;
  }>;
}

export async function fetchDisplayNames(
  userIds: string[]
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const params = new URLSearchParams({ ids: ids.join(",") });
  const res = await fetch(
    `${BACKEND_URL}/api/profiles/display-names?${params.toString()}`
  );

  if (!res.ok) return new Map();

  const data = (await res.json().catch(() => ({}))) as DisplayNameResponse;
  return new Map(
    (data.profiles ?? []).map((profile) => [
      profile.id,
      profile.displayName,
    ])
  );
}
