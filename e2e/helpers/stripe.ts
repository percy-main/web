import Stripe from "stripe";

let _stripe: Stripe | undefined;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export async function findRecentCheckoutSession(
  customerEmail: string,
): Promise<Stripe.Checkout.Session | undefined> {
  const sessions = await getStripe().checkout.sessions.list({
    limit: 10,
  });

  return sessions.data.find(
    (s) => s.customer_details?.email === customerEmail,
  );
}
