import type { FastifyInstance } from "fastify";
import { auctionSellerRoutes } from "./auctions.js";
import { lotSellerRoutes } from "./lots.js";
import { sellerImageRoutes } from "./images.js";
import { sellerPublishRoutes } from "./publish.js";
import { sellerSmsRoutes } from "./sms.js";

export async function sellerRoutes(fastify: FastifyInstance) {
  await fastify.register(async (seller) => {
    await seller.register(auctionSellerRoutes);
    await seller.register(lotSellerRoutes);
    await seller.register(sellerImageRoutes);
    await seller.register(sellerPublishRoutes);
    await seller.register(sellerSmsRoutes);
  }, { prefix: "/api/seller" });
}
