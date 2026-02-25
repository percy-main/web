import { CONTEXT } from "astro:env/client";
import stripeJson from "~/stripe.json";

console.log("[payments/config] CONTEXT =", JSON.stringify(CONTEXT), "-> using", CONTEXT === "production" ? "default (live)" : "dev (test)");

export const paymentData =
  CONTEXT === "production" ? stripeJson.default : stripeJson.dev;
