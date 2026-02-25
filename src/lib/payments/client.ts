import { STRIPE_SECRET_KEY } from "astro:env/server";
import { Stripe } from "stripe";

console.log("[payments/client] STRIPE_SECRET_KEY prefix:", STRIPE_SECRET_KEY?.substring(0, 12));

export const stripe = new Stripe(STRIPE_SECRET_KEY);
