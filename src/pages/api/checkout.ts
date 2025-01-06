export const prerender = false;
import type { APIContext } from "astro";
import { Stripe } from "stripe";
import { STRIPE_SECRET_KEY } from "astro:env/server";

const stripe = new Stripe(STRIPE_SECRET_KEY);

export async function POST({ request }: APIContext): Promise<Response> {
  try {
    const { priceId, gameId } = await request.json();

    const intent = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      redirect_on_completion: "never",
      metadata: {
        gameId,
      },
    });

    return Response.json(
      {
        clientSecret: intent.client_secret,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Failed to create checkout session", error);
    return Response.json({ message: error.message }, { status: 500 });
  }
}
