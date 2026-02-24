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

export async function simulateCheckoutWebhook(
  baseUrl: string,
  checkoutSession: Stripe.Checkout.Session,
): Promise<Response> {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: checkoutSession },
    created: Math.floor(Date.now() / 1000),
    api_version: "2025-01-27.acacia",
  });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  const header = getStripe().webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  return fetch(`${baseUrl}/api/stripe_hook`, {
    method: "POST",
    headers: {
      "stripe-signature": header,
      "content-type": "application/json",
    },
    body: payload,
  });
}
