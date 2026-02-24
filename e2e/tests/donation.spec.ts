import { expect, test } from "@playwright/test";
import { findRecentCheckoutSession } from "../helpers/stripe";

// Dev donation price from stripe.json
const DONATION_PRICE_ID = "price_1PHSBTIoYmCDxYlkBoo86Xdb";
const TEST_EMAIL = `test-e2e-donate-${Date.now()}@example.com`;

test.describe("Donation Checkout", () => {
  test("complete a donation and verify via Stripe API", async ({ page }) => {
    test.setTimeout(120_000); // Stripe iframe can be slow

    // 1. Navigate to checkout page
    await page.goto(`/purchase/${DONATION_PRICE_ID}/`);

    // 2. Wait for Stripe embedded checkout iframe to load
    const checkoutDiv = page.locator("#checkout");
    await expect(checkoutDiv).toBeVisible({ timeout: 30_000 });

    const stripeFrame = checkoutDiv.frameLocator("iframe").first();

    // 3. Fill in donation amount (masked currency input — type "5" for £5.00)
    const amountInput = stripeFrame.locator("#customUnitAmount");
    await amountInput.waitFor({ timeout: 30_000 });
    await amountInput.click();
    await amountInput.press("Control+a");
    await amountInput.pressSequentially("5");

    // 4. Fill in email
    await stripeFrame.locator("#email").fill(TEST_EMAIL);

    // 5. Select Card payment method — Tab to the Card radio, press Space to expand
    await stripeFrame.locator("#email").press("Tab");
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
    await page.waitForTimeout(2000);

    // 6. Fill card details (now visible as regular inputs)
    await stripeFrame.locator("#cardNumber").fill("4242424242424242");
    await stripeFrame.locator("#cardExpiry").fill("12/30");
    await stripeFrame.locator("#cardCvc").fill("123");
    await stripeFrame.locator("#billingName").fill("Test E2E Donor");
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
    expect(session!.payment_status).toBe("paid");
  });
});
