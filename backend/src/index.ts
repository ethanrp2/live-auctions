import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { bastaTokenRoutes } from "./routes/basta-token.js";
import { bastaBidSupportRoutes } from "./routes/basta-bid-support.js";
import { auctionCurrentStateRoutes } from "./routes/auction-current-state.js";
import { bastaWebhookRoutes } from "./routes/webhooks/basta.js";
import { sellerRoutes } from "./routes/seller/index.js";
import { sellerOnboardingRoutes } from "./routes/seller-onboarding.js";
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
  });

  await fastify.register(healthRoutes);
  await fastify.register(bastaTokenRoutes);
  await fastify.register(bastaBidSupportRoutes);
  await fastify.register(auctionCurrentStateRoutes);
  await fastify.register(bastaWebhookRoutes);
  await fastify.register(sellerRoutes);
  await fastify.register(sellerOnboardingRoutes);

  await fastify.listen({ port: config.port, host: "0.0.0.0" });
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
