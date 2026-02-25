/**
 * Netlify Edge Function: Stripe webhook proxy for deploy previews.
 *
 * Production Stripe webhooks can only target a single URL. This proxy runs at
 * the production origin on /api/stripe_proxy and forwards test-mode webhook
 * events to the deploy preview URL embedded in the event metadata.
 *
 * Flow:
 *   Stripe  -->  POST /api/stripe_proxy (this edge function, production)
 *           -->  verifies signature with STRIPE_TEST_WEBHOOK_SECRET
 *           -->  extracts deployPreviewUrl from event metadata
 *           -->  re-signs payload with STRIPE_PREVIEW_WEBHOOK_SECRET
 *           -->  forwards to POST {deployPreviewUrl}/api/stripe_hook
 *           -->  returns 200 to Stripe regardless of forward result
 *
 * Env vars (set in Netlify UI, NOT in Astro env schema):
 *   STRIPE_TEST_WEBHOOK_SECRET    - Stripe signing secret for the test-mode webhook
 *   STRIPE_PREVIEW_WEBHOOK_SECRET - shared secret used to re-sign payloads for previews
 */

import type { Config, Context } from "@netlify/edge-functions";

// ── Crypto helpers (Web Crypto API, Deno-compatible) ────────────────────

async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

// ── Stripe signature verification ───────────────────────────────────────

const SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = signatureHeader.split(",");
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expectedSig = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return signatures.some((sig) => timingSafeEqual(expectedSig, sig));
}

// ── Create a new Stripe-format signature ────────────────────────────────

async function createStripeSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return `t=${timestamp},v1=${sig}`;
}

// ── Extract deployPreviewUrl from Stripe event metadata ─────────────────

function extractDeployPreviewUrl(event: {
  data: {
    object: {
      metadata?: Record<string, string>;
      subscription_details?: { metadata?: Record<string, string> };
    };
  };
}): string | undefined {
  const obj = event.data.object;
  return (
    obj.metadata?.deployPreviewUrl ??
    obj.subscription_details?.metadata?.deployPreviewUrl
  );
}

// ── Validate the URL to prevent open-redirect / SSRF ────────────────────

const ALLOWED_URL_PATTERNS = [
  /^https:\/\/deploy-preview-\d+\.preview\.percymain\.org$/,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/,
];

function isAllowedPreviewUrl(url: string): boolean {
  return ALLOWED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

// ── Edge Function handler ───────────────────────────────────────────────

export default async function handler(
  request: Request,
  _context: Context,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const testWebhookSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");
  const previewWebhookSecret = Deno.env.get("STRIPE_PREVIEW_WEBHOOK_SECRET");

  if (!testWebhookSecret || !previewWebhookSecret) {
    console.error(
      "stripe-proxy: missing STRIPE_TEST_WEBHOOK_SECRET or STRIPE_PREVIEW_WEBHOOK_SECRET env vars",
    );
    // Return 200 to Stripe so it does not retry
    return new Response("Proxy not configured", { status: 200 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  if (!signatureHeader) {
    console.error("stripe-proxy: missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  // Verify the inbound Stripe signature
  const valid = await verifyStripeSignature(
    rawBody,
    signatureHeader,
    testWebhookSecret,
  );

  if (!valid) {
    console.error("stripe-proxy: invalid Stripe signature");
    return new Response("Invalid signature", { status: 400 });
  }

  // Parse the event to find the deploy preview URL
  let event: {
    type: string;
    data: {
      object: {
        metadata?: Record<string, string>;
        subscription_details?: { metadata?: Record<string, string> };
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error("stripe-proxy: failed to parse event JSON");
    return new Response("Invalid JSON", { status: 400 });
  }

  const deployPreviewUrl = extractDeployPreviewUrl(event);

  if (!deployPreviewUrl) {
    console.log(
      `stripe-proxy: no deployPreviewUrl in metadata for event ${event.type}, ignoring`,
    );
    return new Response("No preview URL in metadata", { status: 200 });
  }

  if (!isAllowedPreviewUrl(deployPreviewUrl)) {
    console.error(
      `stripe-proxy: rejected disallowed deployPreviewUrl: ${deployPreviewUrl}`,
    );
    return new Response("Disallowed preview URL", { status: 403 });
  }

  // Re-sign the raw payload with the preview webhook secret
  const newSignature = await createStripeSignature(
    rawBody,
    previewWebhookSecret,
  );

  const forwardUrl = `${deployPreviewUrl}/api/stripe_hook`;

  try {
    const resp = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": newSignature,
      },
      body: rawBody,
    });

    console.log(
      `stripe-proxy: forwarded ${event.type} to ${forwardUrl} => ${resp.status}`,
    );
  } catch (err) {
    console.error(
      `stripe-proxy: failed to forward to ${forwardUrl}:`,
      err,
    );
  }

  // Always return 200 to Stripe to prevent retries
  return new Response("OK", { status: 200 });
}

export const config: Config = {
  path: "/api/stripe_proxy",
};
