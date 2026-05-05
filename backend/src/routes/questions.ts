import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuctionOwnership, requireSeller } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const ANSWER_SEPARATOR = "\n\n---SELLER_ANSWER---\n";

const auctionParamSchema = {
  type: "object",
  required: ["auctionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
  },
} as const;

const questionParamSchema = {
  type: "object",
  required: ["auctionId", "questionId"],
  properties: {
    auctionId: { type: "string", format: "uuid" },
    questionId: { type: "string", format: "uuid" },
  },
} as const;

const askQuestionBodySchema = {
  type: "object",
  required: ["questionText"],
  additionalProperties: false,
  properties: {
    questionText: { type: "string", minLength: 1, maxLength: 1000 },
  },
} as const;

const answerQuestionBodySchema = {
  type: "object",
  required: ["answerText"],
  additionalProperties: false,
  properties: {
    answerText: { type: "string", minLength: 1, maxLength: 1000 },
  },
} as const;

interface QuestionRow {
  id: string;
  auction_id: string;
  tenant_id: string;
  user_id: string | null;
  question_text: string;
  dismissed: boolean;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
}

function parseQuestionText(raw: string): { questionText: string; answerText: string | null } {
  const [questionText, answerText] = raw.split(ANSWER_SEPARATOR);
  return {
    questionText: questionText.trim(),
    answerText: answerText?.trim() || null,
  };
}

function withAnswer(raw: string, answerText: string): string {
  const parsed = parseQuestionText(raw);
  return `${parsed.questionText}${ANSWER_SEPARATOR}${answerText.trim()}`;
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    await reply.status(401).send({ error: "Missing authorization header" });
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    await reply.status(401).send({ error: "Invalid or expired session" });
    return null;
  }

  return user;
}

async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  return data ?? null;
}

function serializeQuestion(row: QuestionRow, profile: ProfileRow | null) {
  const parsed = parseQuestionText(row.question_text);
  return {
    id: row.id,
    auctionId: row.auction_id,
    userId: row.user_id,
    displayName: profile?.display_name ?? "Anonymous",
    questionText: parsed.questionText,
    answerText: parsed.answerText,
    dismissed: row.dismissed,
    createdAt: row.created_at,
  };
}

export async function questionRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: { auctionId: string };
    Body: { questionText: string };
  }>(
    "/api/auctions/:auctionId/questions",
    {
      schema: {
        params: auctionParamSchema,
        body: askQuestionBodySchema,
      },
    },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;

      const { data: auction, error: auctionError } = await supabaseAdmin
        .from("auctions")
        .select("id, tenant_id, status")
        .eq("id", request.params.auctionId)
        .maybeSingle<{ id: string; tenant_id: string; status: string | null }>();

      if (auctionError || !auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }
      if (!["published", "live"].includes(auction.status ?? "")) {
        return reply.status(409).send({ error: "Auction is not accepting questions" });
      }

      const { data: question, error } = await supabaseAdmin
        .from("auction_questions")
        .insert({
          tenant_id: auction.tenant_id,
          auction_id: auction.id,
          user_id: user.id,
          question_text: request.body.questionText.trim(),
          dismissed: false,
        })
        .select("*")
        .single<QuestionRow>();

      if (error || !question) {
        request.log.error({ err: error }, "Failed to create auction question");
        return reply.status(500).send({ error: "Failed to ask question" });
      }

      const profile = await getProfile(user.id);
      return reply.status(201).send({ question: serializeQuestion(question, profile) });
    }
  );

  fastify.get<{ Params: { auctionId: string } }>(
    "/api/auctions/:auctionId/questions/mine",
    { schema: { params: auctionParamSchema } },
    async (request, reply) => {
      const user = await requireUser(request, reply);
      if (!user) return;

      const { data: questions, error } = await supabaseAdmin
        .from("auction_questions")
        .select("*")
        .eq("auction_id", request.params.auctionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        request.log.error({ err: error }, "Failed to load buyer questions");
        return reply.status(500).send({ error: "Failed to load questions" });
      }

      const profile = await getProfile(user.id);
      return reply.send({
        questions: ((questions ?? []) as QuestionRow[]).map((q) =>
          serializeQuestion(q, profile)
        ),
      });
    }
  );

  fastify.post<{
    Params: { auctionId: string; questionId: string };
    Body: { answerText: string };
  }>(
    "/api/auctions/:auctionId/questions/:questionId/answer",
    {
      schema: {
        params: questionParamSchema,
        body: answerQuestionBodySchema,
      },
    },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;

      const auction = await requireAuctionOwnership(request.params.auctionId, seller.tenantId);
      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      const { data: question, error: questionError } = await supabaseAdmin
        .from("auction_questions")
        .select("*")
        .eq("id", request.params.questionId)
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId)
        .maybeSingle<QuestionRow>();

      if (questionError || !question) {
        return reply.status(404).send({ error: "Question not found" });
      }

      const { data: updated, error } = await supabaseAdmin
        .from("auction_questions")
        .update({
          question_text: withAnswer(question.question_text, request.body.answerText),
          dismissed: false,
        })
        .eq("id", question.id)
        .select("*")
        .single<QuestionRow>();

      if (error || !updated) {
        request.log.error({ err: error }, "Failed to answer auction question");
        return reply.status(500).send({ error: "Failed to answer question" });
      }

      const profile = updated.user_id ? await getProfile(updated.user_id) : null;
      return reply.send({ question: serializeQuestion(updated, profile) });
    }
  );

  fastify.post<{ Params: { auctionId: string; questionId: string } }>(
    "/api/auctions/:auctionId/questions/:questionId/dismiss",
    { schema: { params: questionParamSchema } },
    async (request, reply) => {
      const seller = await requireSeller(request, reply);
      if (!seller) return;

      const auction = await requireAuctionOwnership(request.params.auctionId, seller.tenantId);
      if (!auction) {
        return reply.status(404).send({ error: "Auction not found" });
      }

      const { error } = await supabaseAdmin
        .from("auction_questions")
        .update({ dismissed: true })
        .eq("id", request.params.questionId)
        .eq("auction_id", auction.id)
        .eq("tenant_id", seller.tenantId);

      if (error) {
        request.log.error({ err: error }, "Failed to dismiss auction question");
        return reply.status(500).send({ error: "Failed to dismiss question" });
      }

      return reply.send({ ok: true });
    }
  );
}
