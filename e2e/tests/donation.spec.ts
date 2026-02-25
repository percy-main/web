import { readFileSync } from "fs";
import { join } from "path";
import { expect, test } from "../fixtures/base";
import {
  confirmPaymentIntent,
  findRecentPaymentIntent,
} from "../helpers/stripe";

interface StripeConfig {
  dev: { prices: { donation: string } };
}
const stripeConfig: StripeConfig = JSON.parse(
  readFileSync(join(process.cwd(), "stripe.json"), "utf-8"),
) as StripeConfig;
const DONATION_PRICE_ID = stripeConfig.dev.prices.donation;
const TEST_EMAIL = `test-e2e-donate-${Date.now()}@example.com`;

test.describe("Donation Checkout", () => {
  test("complete a donation and verify via Stripe API", async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Navigate to checkout page
    await page.goto(
      `/purchase/${DONATION_PRICE_ID}/?email=${encodeURIComponent(TEST_EMAIL)}`,
    );

    // 2. Wait for PurchaseCheckout to render
    await expect(page.locator("#customAmount")).toBeVisible({ timeout: 30_000 });

    // 3. Fill in custom donation amount (£5)
    await page.locator("#customAmount").fill("5");

    // 4. Click Pay button — this triggers the purchase action which creates
    //    a PaymentIntent in Stripe with the test email in metadata
    await page.getByRole("button", { name: /pay/i }).click();

    // 5. Wait for the PaymentForm to render, proving the PaymentIntent was created
    await expect(page.getByText("Cancel")).toBeVisible({ timeout: 30_000 });

    // 6. Find the PaymentIntent via Stripe API using the test email
    await expect(async () => {
      const pi = await findRecentPaymentIntent(TEST_EMAIL);
      expect(pi).toBeDefined();
    }).toPass({ timeout: 15_000 });

    const pi = await findRecentPaymentIntent(TEST_EMAIL);
    if (!pi) {
      throw new Error(`PaymentIntent not found for ${TEST_EMAIL}`);
    }

    // 7. Confirm payment via Stripe API with test card
    //    (bypasses PaymentElement iframe for reliable CI testing)
    const confirmed = await confirmPaymentIntent(pi.id);
    expect(confirmed.status).toBe("succeeded");

    // 8. Verify the payment is reflected as succeeded
    const verified = await findRecentPaymentIntent(TEST_EMAIL, "succeeded");
    expect(verified).toBeDefined();
    expect(verified?.status).toBe("succeeded");
  });
});
