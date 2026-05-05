import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { bastaTokenRoutes } from "./routes/basta-token.js";
import { bastaBidSupportRoutes } from "./routes/basta-bid-support.js";
import { auctionCurrentStateRoutes } from "./routes/auction-current-state.js";
import { bastaWebhookRoutes } from "./routes/webhooks/basta.js";
import { sellerRoutes } from "./routes/seller/index.js";
import { consoleSellerRoutes } from "./routes/seller/console.js";
import { sellerOnboardingRoutes } from "./routes/seller-onboarding.js";
import { livekitTokenRoutes } from "./routes/livekit-token.js";
import { buyerPaymentRoutes } from "./routes/buyer/payment.js";
import { buyerSmsRoutes } from "./routes/buyer/sms.js";
import { stripeWebhookRoutes } from "./routes/stripe-webhook.js";
import { questionRoutes } from "./routes/questions.js";
import { config } from "./config.js";

const fastify = Fastify({ logger: true });

async function start() {
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests from any subdomain of the root domain
      if (
        !origin ||
        origin.includes(config.rootDomain) ||
        origin.includes("localhost")
      ) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  await fastify.register(healthRoutes);
  await fastify.register(bastaTokenRoutes);
  await fastify.register(bastaBidSupportRoutes);
  await fastify.register(auctionCurrentStateRoutes);
  await fastify.register(bastaWebhookRoutes);
  await fastify.register(sellerRoutes);
  await fastify.register(consoleSellerRoutes);
  await fastify.register(sellerOnboardingRoutes);
  await fastify.register(livekitTokenRoutes);
  await fastify.register(buyerPaymentRoutes);
  await fastify.register(buyerSmsRoutes);
  await fastify.register(questionRoutes);
  // Stripe webhook is registered as its own plugin so its raw-body content
  // type parser is encapsulated and doesn't affect other routes.
  await fastify.register(stripeWebhookRoutes);

  await fastify.listen({ port: config.port, host: "0.0.0.0" });
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
