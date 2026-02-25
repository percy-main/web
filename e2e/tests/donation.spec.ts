import { readFileSync } from "fs";
import { join } from "path";
import { expect, test } from "../fixtures/base";
import {
  fillPaymentElement,
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

    // 1. Navigate to checkout page (include email for Stripe API verification)
    await page.goto(
      `/purchase/${DONATION_PRICE_ID}/?email=${encodeURIComponent(TEST_EMAIL)}`,
    );

    // 2. Wait for PurchaseCheckout to render
    await expect(page.locator("#customAmount")).toBeVisible({ timeout: 30_000 });

    // 3. Fill in custom donation amount (£5)
    await page.locator("#customAmount").fill("5");

    // 4. Click Pay button to create payment intent
    await page.getByRole("button", { name: /pay/i }).click();

    // 5. Wait for PaymentElement to load and fill card details
    await fillPaymentElement(page);

    // 6. Submit payment
    await page.getByRole("button", { name: /pay/i }).click();

    // 7. Wait for success state
    await expect(page.getByText("Payment Successful")).toBeVisible({
      timeout: 60_000,
    });

    // 8. Verify via Stripe API
    await page.waitForTimeout(3000);
    const paymentIntent = await findRecentPaymentIntent(TEST_EMAIL);
    expect(paymentIntent).toBeDefined();
    expect(paymentIntent?.status).toBe("succeeded");
  });
});
