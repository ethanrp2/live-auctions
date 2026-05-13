import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

interface ProfileRow {
  id: string;
  display_name: string | null;
}

function parseIds(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : raw;
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
          )
        )
    )
  ).slice(0, 50);
}

export async function profileDisplayNameRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { ids?: string | string[] } }>(
    "/api/profiles/display-names",
    async (request, reply) => {
      const ids = parseIds(request.query.ids);
      if (ids.length === 0) {
        return reply.send({ profiles: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);

      if (error) {
        request.log.error({ err: error }, "Failed to load display names");
        return reply.status(500).send({ error: "Failed to load display names" });
      }

      return reply.send({
        profiles: ((data ?? []) as ProfileRow[]).map((profile) => ({
          id: profile.id,
          displayName: profile.display_name,
        })),
      });
    }
  );
}
