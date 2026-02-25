import { CONTEXT } from "astro:env/client";
import stripeJson from "~/stripe.json";

export const paymentData =
  CONTEXT === "production" ? stripeJson.default : stripeJson.dev;
