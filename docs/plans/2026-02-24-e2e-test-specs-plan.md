# E2E Test Specs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement E2E tests for homepage structure, full membership signup+payment, members area states, and navigation/content pages.

**Architecture:** Each test file uses the existing Playwright fixture system (fresh DB + dev server per test). A new Stripe webhook simulation helper signs and POSTs events to the local webhook endpoint. The `CollectEmail`/newsletter test is dropped because the component is only embedded via CMS richtext (no fixed route), violating the "no CMS dependency" principle.

**Tech Stack:** Playwright, Stripe SDK (webhook signing), existing base/auth fixtures, Astro dev server

---

### Task 1: Add STRIPE_WEBHOOK_SECRET to .env.test

**Files:**
- Modify: `/.env.test`

**Step 1: Add the env var**

Add this line to the end of `.env.test`:

```
# Webhook signing secret for E2E tests (intentionally not secret)
STRIPE_WEBHOOK_SECRET=this-is-not-a-secret-value
```

**Step 2: Commit**

```bash
git add .env.test
git commit -m "chore: add STRIPE_WEBHOOK_SECRET to .env.test for E2E webhook simulation"
```

---

### Task 2: Add simulateCheckoutWebhook to Stripe helper

**Files:**
- Modify: `e2e/helpers/stripe.ts`

**Step 1: Add the simulateCheckoutWebhook function**

Add to `e2e/helpers/stripe.ts` after the existing `findRecentCheckoutSession` function:

```typescript
export async function simulateCheckoutWebhook(
  baseUrl: string,
  checkoutSession: Stripe.Checkout.Session,
): Promise<Response> {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: checkoutSession },
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
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit -p e2e/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add e2e/helpers/stripe.ts
git commit -m "feat(e2e): add simulateCheckoutWebhook helper for webhook simulation"
```

---

### Task 3: Write homepage.spec.ts

**Files:**
- Create: `e2e/tests/homepage.spec.ts`

**Step 1: Write the test**

```typescript
import { expect, test } from "../fixtures/base";

test.describe("Homepage", () => {
  test("renders hero section with heading and CTA", async ({ page }) => {
    await page.goto("/");

    // Hero heading
    await expect(
      page.getByRole("heading", { name: /sport for everyone/i }),
    ).toBeVisible();

    // Hero CTA link
    await expect(
      page.getByRole("link", { name: /redevelopment plans/i }),
    ).toBeVisible();
  });

  test("renders Our Sports section with sport cards", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /our sports/i }),
    ).toBeVisible();

    // Each sport card links to the correct route
    await expect(page.getByRole("link", { name: /cricket/i }).first()).toHaveAttribute("href", "/cricket");
    await expect(page.getByRole("link", { name: /football/i }).first()).toHaveAttribute("href", "/football");
    await expect(page.getByRole("link", { name: /boxing/i }).first()).toHaveAttribute("href", "/boxing");
    await expect(page.getByRole("link", { name: /running/i }).first()).toHaveAttribute("href", "/running");
  });

  test("renders donation CTA with correct link", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /support your local/i }),
    ).toBeVisible();

    const donateLink = page.getByRole("link", { name: /donate now/i }).first();
    await expect(donateLink).toBeVisible();
    await expect(donateLink).toHaveAttribute("href", /\/purchase\//);
  });

  test("renders header navigation with key links", async ({ page }) => {
    await page.goto("/");

    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "News" })).toHaveAttribute("href", "/news/1");
    await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/calendar");
    await expect(nav.getByRole("link", { name: "People" })).toHaveAttribute("href", "/person");
  });

  test("renders footer with quick links and contact info", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    // Quick links
    await expect(footer.getByRole("link", { name: "Calendar" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "News" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible();

    // Contact info
    await expect(footer.getByText("NE29 6HS")).toBeVisible();
    await expect(footer.getByRole("link", { name: "trustees@percymain.org" })).toBeVisible();
  });
});
```

**Step 2: Run the test**

Run: `npx playwright test homepage`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/tests/homepage.spec.ts
git commit -m "test(e2e): add homepage structural tests"
```

---

### Task 4: Write navigation.spec.ts

**Files:**
- Create: `e2e/tests/navigation.spec.ts`

**Step 1: Write the test**

```typescript
import { expect, test } from "../fixtures/base";

test.describe("Navigation & Content Pages", () => {
  const pages = [
    { path: "/cricket", heading: /cricket/i },
    { path: "/football", heading: /football/i },
    { path: "/boxing", heading: /boxing/i },
    { path: "/running", heading: /running/i },
  ];

  for (const { path, heading } of pages) {
    test(`${path} loads with heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });
  }

  test("/news/1 loads", async ({ page }) => {
    const response = await page.goto("/news/1");
    expect(response?.status()).toBe(200);
  });

  test("/calendar loads", async ({ page }) => {
    const response = await page.goto("/calendar");
    expect(response?.status()).toBe(200);
  });

  test("/person loads", async ({ page }) => {
    const response = await page.goto("/person");
    expect(response?.status()).toBe(200);
  });

  test("/legal/privacy loads with content", async ({ page }) => {
    const response = await page.goto("/legal/privacy");
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).not.toBeEmpty();
  });
});
```

**Note:** The sport pages at `/cricket`, `/football`, `/boxing`, `/running` are CMS-driven via the `[...slug]` catch-all route. The heading assertions use the heading role with a regex, which will match regardless of the specific CMS content as long as the page title contains the sport name. If these pages don't exist in the test CMS environment, the tests will get a 404 — in that case, reduce assertions to just checking the response doesn't crash (no 500). Adjust the heading matchers during implementation based on what the dev server actually renders.

**Step 2: Run the test**

Run: `npx playwright test navigation`
Expected: All tests PASS (or adjust assertions if CMS pages return 404 in test env)

**Step 3: Commit**

```bash
git add e2e/tests/navigation.spec.ts
git commit -m "test(e2e): add navigation and content page structural tests"
```

---

### Task 5: Write members-area.spec.ts

**Files:**
- Create: `e2e/tests/members-area.spec.ts`

**Step 1: Write the test**

```typescript
import { test as authTest } from "../fixtures/auth";
import { test, expect } from "../fixtures/base";

test.describe("Members Area", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/members");

    // MembersPage component calls navigate("/auth/login") when no session
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
  });
});

authTest.describe("Members Area (authenticated)", () => {
  authTest(
    "shows membership tab with empty state",
    async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/members");
      await expect(
        authenticatedPage.getByText("Members Area"),
      ).toBeVisible();

      // Membership tab is default — should show "No Membership"
      await expect(
        authenticatedPage.getByText("No Membership"),
      ).toBeVisible({ timeout: 10_000 });

      // Should have a "Join Now" link
      await expect(
        authenticatedPage.getByRole("link", { name: /join now/i }),
      ).toBeVisible();
    },
  );

  authTest(
    "shows payments tab with empty state",
    async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/members");
      await expect(
        authenticatedPage.getByText("Members Area"),
      ).toBeVisible();

      // Click Payments tab
      await authenticatedPage.getByRole("tab", { name: "Payments" }).click();

      // Should show empty subscriptions and payments
      await expect(
        authenticatedPage.getByText("You have no subscriptions."),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        authenticatedPage.getByText("You are yet to make any purchases."),
      ).toBeVisible();
    },
  );
});
```

**Step 2: Run the test**

Run: `npx playwright test members-area`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/tests/members-area.spec.ts
git commit -m "test(e2e): add members area empty state and auth redirect tests"
```

---

### Task 6: Write membership.spec.ts — the golden path

This is the most complex test. It covers: join form → registration → email verification → login → members area (empty) → pay membership → Stripe checkout → webhook simulation → members area (active membership).

**Files:**
- Create: `e2e/tests/membership.spec.ts`

**Step 1: Write the test**

```typescript
import { readFileSync } from "fs";
import { join } from "path";
import { expect, test } from "../fixtures/base";
import { extractVerificationUrl, getLatestEmail } from "../helpers/email";
import {
  findRecentCheckoutSession,
  simulateCheckoutWebhook,
} from "../helpers/stripe";

interface StripeConfig {
  dev: {
    prices: { donation: string };
    product: { subs_player: string; subs_social: string };
  };
}
const stripeConfig: StripeConfig = JSON.parse(
  readFileSync(join(process.cwd(), "stripe.json"), "utf-8"),
) as StripeConfig;

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
    // The URL should contain the email and name as query params
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

    // Select Card payment
    await stripeFrame
      .locator('[data-testid="card-accordion-item"]')
      .click();

    // Fill card details
    await stripeFrame.locator("#cardNumber").waitFor({ timeout: 10_000 });
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
    expect(session).toBeDefined();
    expect(session!.payment_status).toBe("paid");

    // ─── 14. Simulate webhook ───
    const webhookResponse = await simulateCheckoutWebhook(
      baseURL!,
      session!,
    );
    expect(webhookResponse.ok).toBe(true);

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
```

**Step 2: Run the test**

Run: `npx playwright test membership`
Expected: PASS (this test takes ~2-3 minutes due to Stripe interaction)

**Important notes for implementation:**
- The `/membership/pay` page loads prices from Contentful's `price` collection. If Stripe prices aren't available in the test CMS environment, the page may error. Check what data the dev server has available and adjust selectors accordingly.
- The Stripe embedded checkout selectors (like `#cardNumber`, `data-testid="card-accordion-item"`) are copied from the working `donation.spec.ts`. They should work the same way.
- The `simulateCheckoutWebhook` function sends a minimal event. The webhook handler calls `stripe.checkout.sessions.retrieve(event.data.object.id)` to get the full session from Stripe's API, so the event payload only needs the session `id` to be valid.
- After the webhook, the `Membership` component re-fetches via `actions.membership`. Navigating to `/members` triggers a fresh mount and query.

**Step 3: Commit**

```bash
git add e2e/tests/membership.spec.ts
git commit -m "test(e2e): add full membership signup and payment flow test"
```

---

### Task 7: Run full E2E suite and fix issues

**Step 1: Run all E2E tests together**

Run: `npx playwright test`
Expected: All tests PASS

**Step 2: Fix any failures**

Common issues to watch for:
- **Timing:** If React components need time to hydrate, add `waitFor` with appropriate timeouts
- **CMS data:** If sport pages (cricket, football, etc.) 404 in the test environment, adjust `navigation.spec.ts` to expect 404 or skip those tests
- **Stripe selectors:** If Stripe updates their embedded checkout UI, selectors may need updating — check against what `donation.spec.ts` currently uses
- **Webhook event format:** If the webhook handler rejects the simulated event, check the event structure against what Stripe actually sends. The handler calls `stripe.checkout.sessions.retrieve()` which hits the real Stripe test API, so the session ID in the event must be a real one from the checkout.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(e2e): address test failures from full suite run"
```

---

### Task 8: Type-check and lint

**Step 1: Type-check E2E code**

Run: `npx tsc --noEmit -p e2e/tsconfig.json`
Expected: No errors

**Step 2: Lint E2E code**

Run: `npx eslint e2e/`
Expected: No errors (or only pre-existing warnings)

**Step 3: Fix any issues and commit**

```bash
git add e2e/
git commit -m "chore(e2e): fix type and lint issues"
```

---

## Design Note: Newsletter Test Dropped

The `CollectEmail` component (event subscriber signup) is only rendered via Contentful CMS richtext blocks — there is no dedicated page route. Testing it would require specific CMS content to be present, violating the "no CMS dependency" principle. This test is omitted from the plan.

## Summary of Files

| Action | Path |
|--------|------|
| Modify | `.env.test` |
| Modify | `e2e/helpers/stripe.ts` |
| Create | `e2e/tests/homepage.spec.ts` |
| Create | `e2e/tests/navigation.spec.ts` |
| Create | `e2e/tests/members-area.spec.ts` |
| Create | `e2e/tests/membership.spec.ts` |
