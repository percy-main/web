export const prerender = false;

import { stripe } from "@/lib/payments/client";
import { checkoutSessionCompleted } from "@/lib/payments/handlers/checkout.session.completed";
import { invoicePaymentSucceeded } from "@/lib/payments/handlers/invoice.payment_succeeded";
import { paymentIntentSucceeded } from "@/lib/payments/handlers/payment_intent.succeeded";
import type { APIContext } from "astro";
import { STRIPE_WEBHOOK_SECRET } from "astro:env/server";
import { mkdirSync, writeFileSync } from "fs";
import _ from "lodash/fp";
import path from "path";
import Stripe from "stripe";
import { match, P } from "ts-pattern";

export async function POST({ request }: APIContext): Promise<Response> {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    console.error("Stripe webhook received without signature header");
    return Response.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error: unknown) {
    console.error("Stripe webhook signature verification failed", error);
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  try {
    if (import.meta.env.DEV) {
      const sampleDir = path.join(".sample");
      mkdirSync(sampleDir, { recursive: true });
      writeFileSync(
        path.join(
          sampleDir,
          `${new Date().toISOString()}-stripe-event-${event.type}-${event.created}`,
        ),
        JSON.stringify(event, null, 2),
      );
    }

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
      .with({ type: "invoice.payment_succeeded" }, invoicePaymentSucceeded)
      .with({ type: "payment_intent.succeeded" }, paymentIntentSucceeded)
      .otherwise(_.noop);

    return Response.json({}, { status: 200 });
  } catch (error: unknown) {
    console.error("Stripe webhook handler failed", error);
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
