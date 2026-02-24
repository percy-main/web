import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function findRecentCheckoutSession(
  customerEmail: string,
): Promise<Stripe.Checkout.Session | undefined> {
  const sessions = await stripe.checkout.sessions.list({
    limit: 10,
  });

  return sessions.data.find(
    (s) => s.customer_details?.email === customerEmail,
  );
}
