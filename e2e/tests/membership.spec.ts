import { expect, test } from "../fixtures/base";
import { extractVerificationUrl, getLatestEmail } from "../helpers/email";
import {
  fillPaymentElement,
  findRecentPaymentIntent,
  simulatePaymentIntentWebhook,
} from "../helpers/stripe";

test.describe("Membership", () => {
  const testPassword = "TestPassword123!";

  test("full join, register, pay membership flow", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000);

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

    // Address lookup — use manual entry mode (no postcodes.io in E2E)
    await expect(async () => {
      const btn = page.getByText("Enter address manually");
      if (await btn.isVisible()) await btn.click();
      await expect(page.locator("#street-address")).toBeVisible();
    }).toPass({ timeout: 15_000 });
    await page.locator("#house-number").fill("123");
    await page.locator("#street-address").fill("Test Street");
    await page.locator("#town-city").fill("North Shields");
    await page.locator("#postcode-input").fill("NE29 6HS");

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

    // ─── 12. PurchaseCheckout renders — click Pay button ───
    await expect(
      page.getByRole("button", { name: /pay/i }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /pay/i }).click();

    // ─── 13. Fill PaymentElement card details ───
    await fillPaymentElement(page);

    // ─── 14. Submit payment ───
    await page.getByRole("button", { name: /pay/i }).click();

    // ─── 15. Wait for success state ───
    await expect(page.getByText("Payment Successful")).toBeVisible({
      timeout: 60_000,
    });

    // ─── 16. Verify via Stripe API ───
    await page.waitForTimeout(3000);
    const paymentIntent = await findRecentPaymentIntent(testEmail);
    if (!paymentIntent)
      throw new Error("Payment intent not found via Stripe API");
    expect(paymentIntent.status).toBe("succeeded");

    // ─── 17. Simulate webhook ───
    if (!baseURL) throw new Error("baseURL not set");
    const webhookResponse = await simulatePaymentIntentWebhook(
      baseURL,
      paymentIntent,
    );
    if (!webhookResponse.ok) {
      const body = await webhookResponse.text();
      throw new Error(`Webhook failed (${webhookResponse.status}): ${body}`);
    }

    // ─── 18. Verify membership is now active ───
    await page.goto("/members");
    await expect(page.getByText("Members Area")).toBeVisible();

    await expect(
      page.getByText("Playing Member (Senior)"),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Paid Until")).toBeVisible();
  });
});
