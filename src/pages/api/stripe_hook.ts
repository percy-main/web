export const prerender = false;

import { stripe } from "@/lib/payments/client";
import { checkoutSessionCompleted } from "@/lib/payments/handlers/checkoutSessionCompleted";
import type { APIContext } from "astro";
import { STRIPE_WEBHOOK_SECRET } from "astro:env/server";
import _ from "lodash/fp";
import { match, P } from "ts-pattern";

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const payload = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      throw new Error("No webhook signature provided");
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );

    await match(event)
      .with(
        {
          type: P.union(
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
          ),
        },
        checkoutSessionCompleted,
      )
      .otherwise(_.noop);

    return Response.json({}, { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to create checkout session", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ message }, { status: 500 });
  }
}
