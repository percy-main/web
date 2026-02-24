import { readFileSync } from "fs";
import { join } from "path";
import { expect, test } from "../fixtures/base";
import { findRecentCheckoutSession } from "../helpers/stripe";

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
    test.setTimeout(120_000); // Stripe iframe can be slow

    // 1. Navigate to checkout page
    await page.goto(`/purchase/${DONATION_PRICE_ID}/`);

    // 2. Wait for Stripe embedded checkout iframe to load
    const checkoutDiv = page.locator("#checkout");
    await expect(checkoutDiv).toBeVisible({ timeout: 30_000 });

    const stripeIframe = checkoutDiv.locator("iframe").first();
    const stripeFrame = stripeIframe.contentFrame();

    // 3. Fill in donation amount (masked currency input — type "5" for £5.00)
    const amountInput = stripeFrame.locator("#customUnitAmount");
    await amountInput.waitFor({ timeout: 30_000 });
    await amountInput.click();
    await amountInput.press("Control+a");
    await amountInput.pressSequentially("5");

    // 4. Fill in email
    await stripeFrame.locator("#email").fill(TEST_EMAIL);

    // 5. Select Card payment method by clicking the accordion item directly
    await stripeFrame
      .locator('[data-testid="card-accordion-item"]')
      .click();

    // 6. Wait for card fields to appear then fill them
    await stripeFrame.locator("#cardNumber").waitFor({ timeout: 10_000 });
    await stripeFrame.locator("#cardNumber").fill("4242424242424242");
    await stripeFrame.locator("#cardExpiry").fill("12/30");
    await stripeFrame.locator("#cardCvc").fill("123");
    await stripeFrame.locator("#billingName").fill("Test E2E Donor");

    // 6b. Select United Kingdom before filling postcode (CI defaults to US)
    await stripeFrame
      .getByRole("combobox", { name: "Country or region" })
      .selectOption({ label: "United Kingdom" });

    await stripeFrame.locator("#billingPostalCode").fill("NE1 1AA");

    // 7. Click Pay button
    await stripeFrame
      .locator('button[data-testid="hosted-payment-submit-button"]')
      .click();

    // 8. Wait for success state
    await expect(
      stripeFrame.getByText("Thanks for your payment"),
    ).toBeVisible({ timeout: 60_000 });

    // 9. Verify via Stripe API
    await page.waitForTimeout(3000);
    const session = await findRecentCheckoutSession(TEST_EMAIL);
    expect(session).toBeDefined();
    expect(session?.payment_status).toBe("paid");
  });
});
