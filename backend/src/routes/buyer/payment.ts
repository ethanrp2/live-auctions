import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { supabaseAdmin } from "../../lib/supabase.js";
import { stripe } from "../../lib/stripe.js";

interface BuyerAuthContext {
  userId: string;
  email: string | null;
}

interface BuyerProfileRow {
  id: string;
  stripe_customer_id: string | null;
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

async function requireBuyer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<BuyerAuthContext | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    await reply.status(401).send({ error: "Missing authorization header" });
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    await reply.status(401).send({ error: "Invalid or expired session" });
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
  };
}

async function getOrCreateStripeCustomer(
  userId: string,
  email: string | null
): Promise<string> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<BuyerProfileRow>();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    throw new Error(
      `Failed to persist stripe_customer_id: ${updateError.message}`
    );
  }

  return customer.id;
}

const detachBodySchema = {
  type: "object",
  required: ["paymentMethodId"],
  additionalProperties: false,
  properties: {
    paymentMethodId: { type: "string", minLength: 1 },
  },
} as const;

export async function buyerPaymentRoutes(fastify: FastifyInstance) {
  await fastify.register(async (buyer) => {
    // POST /api/buyer/setup-intent — Create a SetupIntent for saving a card.
    buyer.post("/setup-intent", async (request, reply) => {
      const auth = await requireBuyer(request, reply);
      if (!auth) {
        return;
      }

      try {
        const customerId = await getOrCreateStripeCustomer(
          auth.userId,
          auth.email
        );

        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ["card"],
        });

        return reply.send({ clientSecret: setupIntent.client_secret });
      } catch (err) {
        request.log.error({ err }, "Failed to create SetupIntent");
        return reply
          .status(500)
          .send({ error: "Failed to create setup intent" });
      }
    });

    // GET /api/buyer/payment-methods — List saved card payment methods.
    buyer.get("/payment-methods", async (request, reply) => {
      const auth = await requireBuyer(request, reply);
      if (!auth) {
        return;
      }

      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("id, stripe_customer_id")
        .eq("id", auth.userId)
        .maybeSingle<BuyerProfileRow>();

      if (error) {
        request.log.error({ err: error }, "Failed to load profile");
        return reply.status(500).send({ error: "Failed to load profile" });
      }

      if (!profile?.stripe_customer_id) {
        return reply.send({ paymentMethods: [] });
      }

      try {
        const list = await stripe.paymentMethods.list({
          customer: profile.stripe_customer_id,
          type: "card",
        });

        const paymentMethods = list.data.map((pm: Stripe.PaymentMethod) => ({
          id: pm.id,
          brand: pm.card?.brand ?? null,
          last4: pm.card?.last4 ?? null,
          expMonth: pm.card?.exp_month ?? null,
          expYear: pm.card?.exp_year ?? null,
        }));

        return reply.send({ paymentMethods });
      } catch (err) {
        request.log.error({ err }, "Failed to list payment methods");
        return reply
          .status(500)
          .send({ error: "Failed to list payment methods" });
      }
    });

    // POST /api/buyer/detach-payment-method — Remove a saved card.
    buyer.post<{ Body: { paymentMethodId: string } }>(
      "/detach-payment-method",
      {
        schema: {
          body: detachBodySchema,
        },
      },
      async (request, reply) => {
        const auth = await requireBuyer(request, reply);
        if (!auth) {
          return;
        }

        const { data: profile, error } = await supabaseAdmin
          .from("profiles")
          .select("id, stripe_customer_id")
          .eq("id", auth.userId)
          .maybeSingle<BuyerProfileRow>();

        if (error || !profile?.stripe_customer_id) {
          return reply
            .status(404)
            .send({ error: "No Stripe customer for this user" });
        }

        try {
          const pm = await stripe.paymentMethods.retrieve(
            request.body.paymentMethodId
          );

          if (pm.customer !== profile.stripe_customer_id) {
            return reply
              .status(403)
              .send({ error: "Payment method does not belong to user" });
          }

          await stripe.paymentMethods.detach(request.body.paymentMethodId);

          return reply.send({ ok: true });
        } catch (err) {
          request.log.error({ err }, "Failed to detach payment method");
          return reply
            .status(500)
            .send({ error: "Failed to detach payment method" });
        }
      }
    );
  }, { prefix: "/api/buyer" });
}
