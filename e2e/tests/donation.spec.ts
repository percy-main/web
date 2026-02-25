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
    //    First load may trigger Vite dep optimization + full reload, so we
    //    navigate, wait for the component, then reload to get a stable page.
    await page.goto(
      `/purchase/${DONATION_PRICE_ID}/?email=${encodeURIComponent(TEST_EMAIL)}`,
    );
    await expect(page.locator("#customAmount")).toBeVisible({ timeout: 30_000 });
    await page.reload();

    // 2. Wait for PurchaseCheckout to render (stable after Vite optimization)
    await expect(page.locator("#customAmount")).toBeVisible({ timeout: 30_000 });

    // 3. Fill in custom donation amount (£5)
    await page.locator("#customAmount").fill("5");

    // 4. Click Pay button to create payment intent
    await page.getByRole("button", { name: /pay/i }).click();

    // 5. Wait for PaymentElement to load and fill card details
    await fillPaymentElement(page);

    // 6. Submit payment
    await page.getByRole("button", { name: /pay/i }).click();

    // 7. Verify payment succeeded via Stripe API
    //    (more reliable than checking UI state, which can be reset by dev-server HMR)
    await expect(async () => {
      const pi = await findRecentPaymentIntent(TEST_EMAIL);
      expect(pi).toBeDefined();
      expect(pi?.status).toBe("succeeded");
    }).toPass({ timeout: 60_000 });
  });
});
