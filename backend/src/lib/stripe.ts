import Stripe from "stripe";
import { config } from "../config.js";

export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: "2026-04-22.dahlia",
});
