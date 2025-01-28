import { STRIPE_SECRET_KEY } from "astro:env/server";
import { Stripe } from "stripe";

export const stripe = new Stripe(STRIPE_SECRET_KEY);
