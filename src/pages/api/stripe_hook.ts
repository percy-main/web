export const prerender = false;
import { stripe } from "@/lib/payments/client";
import * as handlers from "@/lib/payments/handlers";
import type { APIContext } from "astro";
import { STRIPE_WEBHOOK_SECRET } from "astro:env/server";

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

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await handlers.paymentSucceeded(event.data.object.id);
    }

    return Response.json({}, { status: 200 });
  } catch (error: any) {
    console.error("Failed to create checkout session", error);
    return Response.json({ message: error.message }, { status: 500 });
  }
}
