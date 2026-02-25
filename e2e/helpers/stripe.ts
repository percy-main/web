import type { Page } from "@playwright/test";
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

/**
 * Confirm a payment intent using a test card via the Stripe API.
 * This bypasses the PaymentElement iframe for more reliable CI testing.
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.confirm(paymentIntentId, {
    payment_method: "pm_card_visa",
    return_url: "https://example.com/return",
  });
}

export async function findRecentPaymentIntent(
  email: string,
  status?: string,
): Promise<Stripe.PaymentIntent | undefined> {
  const intents = await getStripe().paymentIntents.list({
    limit: 10,
  });

  return intents.data.find(
    (pi) =>
      pi.metadata.email === email && (status ? pi.status === status : true),
  );
}

function signAndSend(
  baseUrl: string,
  eventType: string,
  dataObject: unknown,
): Promise<Response> {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: eventType,
    data: { object: dataObject },
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

export async function simulateCheckoutWebhook(
  baseUrl: string,
  checkoutSession: Stripe.Checkout.Session,
): Promise<Response> {
  return signAndSend(baseUrl, "checkout.session.completed", checkoutSession);
}

export async function simulatePaymentIntentWebhook(
  baseUrl: string,
  paymentIntent: Stripe.PaymentIntent,
): Promise<Response> {
  return signAndSend(baseUrl, "payment_intent.succeeded", paymentIntent);
}

export async function simulateInvoiceWebhook(
  baseUrl: string,
  invoice: Stripe.Invoice,
): Promise<Response> {
  return signAndSend(baseUrl, "invoice.payment_succeeded", invoice);
}

/**
 * Fill the Stripe PaymentElement card fields within the iframe.
 * PaymentElement renders a single iframe with card number, expiry, and CVC inputs.
 */
export async function fillPaymentElement(page: Page) {
  const stripeFrame = page.frameLocator(
    'iframe[title="Secure payment input frame"]',
  );

  await stripeFrame
    .locator("#payment-numberInput")
    .waitFor({ timeout: 30_000 });
  await stripeFrame
    .locator("#payment-numberInput")
    .fill("4242424242424242");
  await stripeFrame.locator("#payment-expiryInput").fill("1230");
  await stripeFrame.locator("#payment-cvcInput").fill("123");
  // Fill postal code if visible (required for UK cards)
  const postalCode = stripeFrame.locator("#payment-postalCodeInput");
  if ((await postalCode.count()) > 0) {
    await postalCode.fill("NE29 6HS");
  }
}
