import type { FastifyInstance } from "fastify";
import { requireAuthedUser } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const submitQuestionSchema = {
  type: "object",
  required: ["auctionId", "questionText"],
  additionalProperties: false,
  properties: {
    auctionId: { type: "string", format: "uuid" },
    questionText: { type: "string", minLength: 1, maxLength: 500 },
  },
} as const;

export async function buyerRoutes(fastify: FastifyInstance) {
  await fastify.register(async (buyer) => {
    buyer.post<{
      Body: { auctionId: string; questionText: string };
    }>(
      "/questions",
      { schema: { body: submitQuestionSchema } },
      async (request, reply) => {
        const user = await requireAuthedUser(request, reply);
        if (!user) return;

        const { auctionId, questionText } = request.body;

        const { data: auction, error: auctionError } = await supabaseAdmin
          .from("auctions")
          .select("id, tenant_id, status")
          .eq("id", auctionId)
          .maybeSingle<{
            id: string;
            tenant_id: string;
            status: string | null;
          }>();
        if (auctionError || !auction) {
          return reply.status(404).send({ error: "Auction not found" });
        }
        if (auction.status !== "live") {
          return reply
            .status(409)
            .send({ error: "Questions can only be asked during a live auction" });
        }

        const { data, error } = await supabaseAdmin
          .from("auction_questions")
          .insert({
            tenant_id: auction.tenant_id,
            auction_id: auction.id,
            user_id: user.userId,
            question_text: questionText.trim(),
            dismissed: false,
          })
          .select("id, tenant_id, auction_id, user_id, question_text, dismissed, created_at")
          .single();

        if (error || !data) {
          request.log.error({ err: error }, "Failed to insert auction question");
          return reply.status(500).send({ error: "Failed to submit question" });
        }

        return reply.status(201).send({ question: data });
      }
    );
  }, { prefix: "/api/buyer" });
}
