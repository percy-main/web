import { Stripe } from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";

export const stripe = new Stripe(STRIPE_SECRET_KEY);
