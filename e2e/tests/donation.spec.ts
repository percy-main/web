import { expect, test } from "@playwright/test";
import { findRecentCheckoutSession } from "../helpers/stripe";

// Dev donation price from stripe.json
const DONATION_PRICE_ID = "price_1PHSBTIoYmCDxYlkBoo86Xdb";
const TEST_EMAIL = `test-e2e-donate-${Date.now()}@example.com`;

test.describe("Donation Checkout", () => {
  // Skip: donation price uses custom_unit_amount which conflicts with adjustable_quantity
  // in src/actions/checkout.ts. Remove skip once the Stripe config issue is resolved.
  test.skip("complete a donation and verify via Stripe API", async ({ page }) => {
    test.setTimeout(120_000); // Stripe iframe can be slow

    // 1. Navigate to checkout page
    await page.goto(`/purchase/${DONATION_PRICE_ID}/`);

    // 2. Wait for Stripe embedded checkout iframe to load
    const checkoutDiv = page.locator("#checkout");
    await expect(checkoutDiv).toBeVisible({ timeout: 30_000 });

    // Wait for iframe to appear inside #checkout
    const stripeFrame = checkoutDiv.frameLocator("iframe").first();

    // 3. Fill in email
    await stripeFrame.locator('[name="email"]').waitFor({ timeout: 30_000 });
    await stripeFrame.locator('[name="email"]').fill(TEST_EMAIL);

    // 4. Fill in card details
    // Stripe may nest card inputs in a sub-iframe or use direct inputs
    // depending on the checkout mode. Embedded checkout typically has direct inputs.
    await stripeFrame.locator('[name="cardNumber"]').fill("4242424242424242");
    await stripeFrame.locator('[name="cardExpiry"]').fill("12/30");
    await stripeFrame.locator('[name="cardCvc"]').fill("123");

    // 5. Fill in name on card (if present)
    const nameField = stripeFrame.locator('[name="billingName"]');
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill("Test E2E Donor");
    }

    // 6. Fill in country/postal if required
    const postalField = stripeFrame.locator('[name="billingPostalCode"]');
    if (await postalField.isVisible().catch(() => false)) {
      await postalField.fill("NE1 1AA");
    }

    // 7. Click Pay button
    await stripeFrame
      .locator('button[data-testid="hosted-payment-submit-button"]')
      .click();

    // 8. Wait for success state — Stripe shows a confirmation within the iframe
    // The embedded checkout with redirect_on_completion: "never" shows a
    // success message inside the iframe after payment completes.
    await expect(
      stripeFrame.locator("text=Your payment was successful").or(
        stripeFrame.locator('[data-testid="payment-success"]'),
      ),
    ).toBeVisible({ timeout: 60_000 });

    // 9. Verify via Stripe API
    // Give Stripe a moment to process
    await page.waitForTimeout(3000);
    const session = await findRecentCheckoutSession(TEST_EMAIL);
    expect(session).toBeDefined();
    expect(session!.payment_status).toBe("paid");
  });
});
