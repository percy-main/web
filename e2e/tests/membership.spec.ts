import { expect, test } from "../fixtures/base";
import { extractVerificationUrl, getLatestEmail } from "../helpers/email";
import {
  findRecentCheckoutSession,
  simulateCheckoutWebhook,
} from "../helpers/stripe";

test.describe("Membership", () => {
  const testPassword = "TestPassword123!";

  test("full join, register, pay membership flow", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000); // Long flow with Stripe

    const testId = Date.now();
    const testEmail = `test-e2e-member-${testId}@example.com`;
    const testName = `Test Member ${testId}`;

    // ─── 1. Fill and submit the join form ───
    await page.goto("/membership/join");
    await expect(
      page.getByRole("heading", { name: /join percy main/i }),
    ).toBeVisible();

    await page.locator("#title").fill("Mr");
    await page.locator("#name").fill(testName);
    await page.locator("#address").fill("123 Test Street\nNorth Shields");
    await page.locator("#postcode").fill("NE29 6HS");
    await page.locator("#dob").fill("1990-01-15");
    await page.locator("#telephone").fill("07700900000");
    await page.locator("#email").fill(testEmail);
    await page.locator("#emerg_name").fill("Emergency Contact");
    await page.locator("#emerg_phone").fill("07700900001");

    await page.locator('button[type="submit"]').click();

    // ─── 2. Should redirect to registration with pre-filled data ───
    await expect(page).toHaveURL(/\/auth\/register/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get("email")).toBe(testEmail);

    // ─── 3. Complete registration ───
    await page.locator("#name").waitFor({ state: "attached" });
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/auth\/registered/, { timeout: 10_000 });

    // ─── 4. Email verification ───
    await page.waitForTimeout(2000);
    const { html } = await getLatestEmail();
    const verificationUrl = extractVerificationUrl(html);
    await page.goto(verificationUrl);
    await page.waitForURL(/\/auth\/email-confirmed/);

    // ─── 5. Login ───
    await page.goto("/auth/login");
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/members/);

    // ─── 6. Verify members area shows empty membership ───
    await expect(page.getByText("Members Area")).toBeVisible();
    await expect(page.getByText("No Membership")).toBeVisible({
      timeout: 10_000,
    });

    // ─── 7. Navigate to pay membership ───
    await page.goto("/membership/pay");
    await expect(
      page.getByRole("heading", { name: /your membership/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // ─── 8. Select Senior Player ───
    await page
      .locator('label:has-text("Senior Player")')
      .first()
      .click();

    // ─── 9. Select Annual ───
    await page.locator('label:has-text("Annually")').click();

    // ─── 10. Select Online payment ───
    await page.locator('label:has-text("Online")').click();

    // ─── 11. Click "Pay Online" link ───
    const payLink = page.getByRole("link", { name: /pay online/i });
    await expect(payLink).toBeVisible({ timeout: 5_000 });
    const payHref = await payLink.getAttribute("href");
    expect(payHref).toContain("/purchase/");

    await payLink.click();

    // ─── 12. Fill Stripe embedded checkout ───
    const checkoutDiv = page.locator("#checkout");
    await expect(checkoutDiv).toBeVisible({ timeout: 30_000 });

    const stripeIframe = checkoutDiv.locator("iframe").first();
    const stripeFrame = stripeIframe.contentFrame();

    // Fill email
    await stripeFrame.locator("#email").waitFor({ timeout: 30_000 });
    await stripeFrame.locator("#email").fill(testEmail);

    // Select Card payment (accordion may not exist if card is the only/default method)
    const cardAccordion = stripeFrame.locator(
      '[data-testid="card-accordion-item"]',
    );
    if (await cardAccordion.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cardAccordion.click();
    }

    // Fill card details
    await stripeFrame.locator("#cardNumber").waitFor({ timeout: 30_000 });
    await stripeFrame.locator("#cardNumber").fill("4242424242424242");
    await stripeFrame.locator("#cardExpiry").fill("12/30");
    await stripeFrame.locator("#cardCvc").fill("123");
    await stripeFrame.locator("#billingName").fill(testName);

    // Select UK and fill postcode
    await stripeFrame
      .getByRole("combobox", { name: "Country or region" })
      .selectOption({ label: "United Kingdom" });
    await stripeFrame.locator("#billingPostalCode").fill("NE29 6HS");

    // Submit payment
    await stripeFrame
      .locator('button[data-testid="hosted-payment-submit-button"]')
      .click();

    // Wait for success
    await expect(
      stripeFrame.getByText("Thanks for your payment"),
    ).toBeVisible({ timeout: 60_000 });

    // ─── 13. Verify via Stripe API ───
    await page.waitForTimeout(3000);
    const session = await findRecentCheckoutSession(testEmail);
    if (!session) throw new Error("Checkout session not found");
    expect(session.payment_status).toBe("paid");

    // ─── 14. Simulate webhook ───
    if (!baseURL) throw new Error("baseURL not set");
    const webhookResponse = await simulateCheckoutWebhook(
      baseURL,
      session,
    );
    if (!webhookResponse.ok) {
      const body = await webhookResponse.text();
      throw new Error(`Webhook failed (${webhookResponse.status}): ${body}`);
    }

    // ─── 15. Verify membership is now active ───
    await page.goto("/members");
    await expect(page.getByText("Members Area")).toBeVisible();

    // The membership card should now show the type instead of "No Membership"
    await expect(
      page.getByText("Playing Member (Senior)"),
    ).toBeVisible({ timeout: 10_000 });

    // Should show "Paid Until" with a date
    await expect(page.getByText("Paid Until")).toBeVisible();
  });
});
