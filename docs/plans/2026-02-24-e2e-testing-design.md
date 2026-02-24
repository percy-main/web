# E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Playwright E2E tests covering auth flows (register, verify email, login, logout, forgot password) and donation checkout with Stripe API verification.

**Architecture:** Playwright tests run against the Astro dev server (`localhost:4321`). Auth emails are captured from the `.emails/` directory (dev mode writes emails to disk). Stripe interactions use `frameLocator` to fill the embedded checkout iframe. A global setup cleans test user data between runs. CI runs via GitHub Actions with secrets for Stripe/Contentful/auth keys.

**Tech Stack:** Playwright, Stripe Node SDK, Kysely (for DB seeding/cleanup), LibSQL

---

### Task 1: Install Playwright and create config

**Files:**
- Modify: `package.json` (add devDependency + script)
- Create: `playwright.config.ts`
- Modify: `.gitignore` (add Playwright artifacts)

**Step 1: Install Playwright**

Run: `npm install -D @playwright/test`
Then: `npx playwright install chromium`

**Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Step 3: Add `test:e2e` script to `package.json`**

Add to `scripts`:
```json
"test:e2e": "playwright test"
```

**Step 4: Add to `.gitignore`**

Append:
```
test-results/
playwright-report/
```

**Step 5: Commit**

```bash
git add playwright.config.ts package.json package-lock.json .gitignore
git commit -m "chore: install Playwright and add E2E config"
```

---

### Task 2: Create email helper

**Files:**
- Create: `e2e/helpers/email.ts`

The dev server writes emails to `.emails/` as `<timestamp>.html` + `<timestamp>.json`. This helper reads the most recent email and extracts URLs from it.

**Step 1: Create `e2e/helpers/email.ts`**

```ts
import { readdir, readFile, rm } from "fs/promises";
import { join } from "path";

const EMAILS_DIR = join(process.cwd(), ".emails");

export async function getLatestEmail(): Promise<{
  html: string;
  json: Record<string, unknown>;
}> {
  const files = await readdir(EMAILS_DIR);
  const htmlFiles = files
    .filter((f) => f.endsWith(".html"))
    .sort()
    .reverse();

  if (htmlFiles.length === 0) {
    throw new Error("No emails found in .emails/");
  }

  const latest = htmlFiles[0];
  const baseName = latest.replace(".html", "");

  const html = await readFile(join(EMAILS_DIR, `${baseName}.html`), "utf-8");
  const json = JSON.parse(
    await readFile(join(EMAILS_DIR, `${baseName}.json`), "utf-8"),
  );

  return { html, json };
}

export function extractUrl(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  if (!match?.[0]) {
    throw new Error(`No URL matching ${pattern} found in email`);
  }
  return match[0];
}

export function extractVerificationUrl(html: string): string {
  return extractUrl(html, /http[s]?:\/\/[^\s"<]+\/api\/auth\/verify-email[^\s"<]*/);
}

export function extractResetUrl(html: string): string {
  return extractUrl(html, /http[s]?:\/\/[^\s"<]+\/auth\/reset-password[^\s"<]*/);
}

export async function clearEmails(): Promise<void> {
  const files = await readdir(EMAILS_DIR).catch(() => []);
  await Promise.all(files.map((f) => rm(join(EMAILS_DIR, f))));
}
```

**Step 2: Commit**

```bash
git add e2e/helpers/email.ts
git commit -m "feat(e2e): add email helper for reading dev emails from disk"
```

---

### Task 3: Create Stripe helper

**Files:**
- Create: `e2e/helpers/stripe.ts`

**Step 1: Create `e2e/helpers/stripe.ts`**

```ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function findRecentCheckoutSession(
  customerEmail: string,
): Promise<Stripe.Checkout.Session | undefined> {
  const sessions = await stripe.checkout.sessions.list({
    limit: 10,
  });

  return sessions.data.find(
    (s) => s.customer_details?.email === customerEmail,
  );
}
```

**Step 2: Commit**

```bash
git add e2e/helpers/stripe.ts
git commit -m "feat(e2e): add Stripe helper for verifying checkout sessions"
```

---

### Task 4: Create global setup for DB cleanup

**Files:**
- Create: `e2e/global-setup.ts`
- Modify: `playwright.config.ts` (add `globalSetup`)

**Step 1: Create `e2e/global-setup.ts`**

This cleans up test user data before each test run. It uses the same LibSQL DB the dev server uses.

```ts
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";
import { mkdir } from "fs/promises";
import { join } from "path";

const TEST_EMAIL_PREFIX = "test-e2e";

export default async function globalSetup() {
  const db = new Kysely<any>({
    dialect: new LibsqlDialect({
      url: process.env.DB_SYNC_URL || "file:local.db",
      authToken: process.env.DB_TOKEN || undefined,
    }),
  });

  try {
    // Delete test users and their related data
    const testUsers = await db
      .selectFrom("user")
      .select("id")
      .where("email", "like", `${TEST_EMAIL_PREFIX}%`)
      .execute();

    const userIds = testUsers.map((u) => u.id);

    if (userIds.length > 0) {
      await db.deleteFrom("session").where("userId", "in", userIds).execute();
      await db.deleteFrom("account").where("userId", "in", userIds).execute();
      await db.deleteFrom("passkey").where("userId", "in", userIds).execute();
      await db.deleteFrom("twoFactor").where("userId", "in", userIds).execute();
      await db
        .deleteFrom("user")
        .where("email", "like", `${TEST_EMAIL_PREFIX}%`)
        .execute();
    }
  } finally {
    await db.destroy();
  }

  // Ensure .emails directory exists
  await mkdir(join(process.cwd(), ".emails"), { recursive: true });
}
```

**Step 2: Add `globalSetup` to `playwright.config.ts`**

Add this line to the `defineConfig` object:
```ts
globalSetup: "./e2e/global-setup.ts",
```

**Step 3: Commit**

```bash
git add e2e/global-setup.ts playwright.config.ts
git commit -m "feat(e2e): add global setup for test DB cleanup"
```

---

### Task 5: Create auth fixture

**Files:**
- Create: `e2e/fixtures/auth.ts`

This provides a reusable `authenticatedPage` fixture that seeds a verified user in the DB and logs in via the API to get a session cookie. Tests that need auth state use this instead of clicking through the UI.

**Step 1: Create `e2e/fixtures/auth.ts`**

```ts
import { test as base, type Page } from "@playwright/test";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";

type AuthFixtures = {
  authenticatedPage: Page;
  testUser: { email: string; password: string; name: string };
};

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    const id = Math.random().toString(36).slice(2, 8);
    await use({
      email: `test-e2e-${id}@example.com`,
      password: "TestPassword123!",
      name: `Test User ${id}`,
    });
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Register via the API
    const signUpRes = await page.request.post("/api/auth/sign-up/email", {
      data: {
        name: testUser.name,
        email: testUser.email,
        password: testUser.password,
      },
    });

    if (!signUpRes.ok()) {
      throw new Error(`Sign-up failed: ${signUpRes.status()}`);
    }

    // Mark email as verified directly in DB
    const db = new Kysely<any>({
      dialect: new LibsqlDialect({
        url: process.env.DB_SYNC_URL || "file:local.db",
        authToken: process.env.DB_TOKEN || undefined,
      }),
    });

    try {
      await db
        .updateTable("user")
        .set({ emailVerified: 1 })
        .where("email", "=", testUser.email)
        .execute();
    } finally {
      await db.destroy();
    }

    // Sign in via the API to get session cookies
    const signInRes = await page.request.post("/api/auth/sign-in/email", {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    if (!signInRes.ok()) {
      throw new Error(`Sign-in failed: ${signInRes.status()}`);
    }

    await use(page);
  },
});

export { expect } from "@playwright/test";
```

**Step 2: Commit**

```bash
git add e2e/fixtures/auth.ts
git commit -m "feat(e2e): add auth fixture for seeded authenticated users"
```

---

### Task 6: Write auth flow tests

**Files:**
- Create: `e2e/tests/auth.spec.ts`

**Step 1: Create `e2e/tests/auth.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { test as authTest } from "../fixtures/auth";
import {
  clearEmails,
  extractResetUrl,
  extractVerificationUrl,
  getLatestEmail,
} from "../helpers/email";

test.describe("Registration + Email Verification + Login", () => {
  const testEmail = `test-e2e-reg-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  test.beforeEach(async () => {
    await clearEmails();
  });

  test("full registration flow", async ({ page }) => {
    // 1. Go to registration with pre-filled name/email
    await page.goto(
      `/auth/register?name=Test+E2E+User&email=${encodeURIComponent(testEmail)}`,
    );

    // 2. Fill password and submit
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // 3. Should land on /auth/registered
    await expect(page).toHaveURL("/auth/registered/");
    await expect(page.getByText("Thanks for joining!")).toBeVisible();

    // 4. Read verification email
    // Wait a moment for email to be written to disk
    await page.waitForTimeout(2000);
    const { html } = await getLatestEmail();
    const verificationUrl = extractVerificationUrl(html);

    // 5. Visit verification URL
    await page.goto(verificationUrl);
    await page.waitForURL("**/auth/email-confirmed/**");

    // 6. Go to login, fill credentials
    await page.goto("/auth/login");
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // 7. Should redirect to /members
    await page.waitForURL("**/members/**");
    await expect(page.getByText("Members Area")).toBeVisible();
  });
});

test.describe("Login", () => {
  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator("#email").fill("nonexistent@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=Invalid email or password").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

authTest.describe("Logout", () => {
  authTest("redirects to home after logout", async ({ authenticatedPage }) => {
    // Confirm we're logged in
    await authenticatedPage.goto("/members");
    await expect(authenticatedPage.getByText("Members Area")).toBeVisible();

    // Click sign out
    await authenticatedPage.goto("/auth/logout");

    // Should redirect to home
    await authenticatedPage.waitForURL("/");
  });
});

test.describe("Forgot Password", () => {
  const testEmail = `test-e2e-forgot-${Date.now()}@example.com`;
  const originalPassword = "OriginalPass123!";
  const newPassword = "NewPassword456!";

  test.beforeAll(async ({ request }) => {
    // Seed a verified user for this test
    await request.post("http://localhost:4321/api/auth/sign-up/email", {
      data: {
        name: "Forgot Test User",
        email: testEmail,
        password: originalPassword,
      },
    });

    // Mark as verified in DB
    const { LibsqlDialect } = await import("@libsql/kysely-libsql");
    const { Kysely } = await import("kysely");
    const db = new Kysely<any>({
      dialect: new LibsqlDialect({
        url: process.env.DB_SYNC_URL || "file:local.db",
        authToken: process.env.DB_TOKEN || undefined,
      }),
    });
    await db
      .updateTable("user")
      .set({ emailVerified: 1 })
      .where("email", "=", testEmail)
      .execute();
    await db.destroy();
  });

  test("forgot password flow", async ({ page }) => {
    await clearEmails();

    // 1. Go to login, click forgot password
    await page.goto("/auth/login");
    await page.getByText("Forgot password?").click();

    // 2. Enter email and submit
    await page.locator("#email-forgotten").fill(testEmail);
    await page.locator('button[type="submit"]').click();

    // 3. Wait for confirmation message
    await expect(
      page.getByText("We've sent you an email with a link"),
    ).toBeVisible({ timeout: 10_000 });

    // 4. Read reset email
    await page.waitForTimeout(2000);
    const { html } = await getLatestEmail();
    const resetUrl = extractResetUrl(html);

    // 5. Visit reset URL, enter new password
    await page.goto(resetUrl);
    await page.locator("#mew-password").fill(newPassword);
    await page.locator('button[type="submit"]').click();

    // 6. Should transition back to login phase
    await expect(page.getByText("Sign in to your account")).toBeVisible({
      timeout: 10_000,
    });

    // 7. Login with new password
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(newPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/members/**");
    await expect(page.getByText("Members Area")).toBeVisible();
  });
});
```

**Step 2: Run tests to verify they work**

Run: `npx playwright test e2e/tests/auth.spec.ts`

Expected: All 4 tests pass (registration flow, invalid login, logout, forgot password).

**Step 3: Commit**

```bash
git add e2e/tests/auth.spec.ts
git commit -m "feat(e2e): add auth flow tests"
```

---

### Task 7: Write donation checkout test

**Files:**
- Create: `e2e/tests/donation.spec.ts`

Ref: The dev donation price ID is `price_1PHSBTIoYmCDxYlkBoo86Xdb` (from `stripe.json` under `dev.prices.donation`). The `Checkout` component mounts Stripe's embedded checkout into `<div id="checkout">`.

**Step 1: Create `e2e/tests/donation.spec.ts`**

```ts
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
```

**Important notes for the implementer:**
- Stripe's embedded checkout iframe field selectors may vary. If the selectors above don't match, run `npx playwright test --debug` to visually inspect the iframe DOM and update selectors accordingly.
- The `data-testid="hosted-payment-submit-button"` is Stripe's standard test ID for the pay button in embedded checkout, but verify this in the debug inspector.
- If Stripe renders card fields in nested sub-iframes (sometimes happens), you'll need chained `frameLocator` calls.

**Step 2: Run the donation test**

Run: `npx playwright test e2e/tests/donation.spec.ts`

Expected: Test passes, Stripe API confirms `payment_status: "paid"`.

**Step 3: Commit**

```bash
git add e2e/tests/donation.spec.ts
git commit -m "feat(e2e): add donation checkout test with Stripe verification"
```

---

### Task 8: Add GitHub Actions workflow

**Files:**
- Create: `.github/workflows/e2e.yml`

**Step 1: Create `.github/workflows/e2e.yml`**

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Create .emails directory
        run: mkdir -p .emails

      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: http://localhost:4321
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_PUBLIC_KEY: ${{ secrets.STRIPE_PUBLIC_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
          BETTER_AUTH_URL: http://localhost:4321
          BETTER_AUTH_RP_ID: localhost
          BETTER_AUTH_RP_NAME: Percy Main Test
          CDN_TOKEN: ${{ secrets.CDN_TOKEN }}
          CDN_CMA_TOKEN: ${{ secrets.CDN_CMA_TOKEN }}
          CDN_SPACE_ID: ${{ secrets.CDN_SPACE_ID }}
          CDN_PREVIEW_TOKEN: ${{ secrets.CDN_PREVIEW_TOKEN }}
          CDN_ENVIRONMENT: ${{ secrets.CDN_ENVIRONMENT }}
          MAPS_API_KEY: ${{ secrets.MAPS_API_KEY }}
          MAPS_MAP_ID: ${{ secrets.MAPS_MAP_ID }}
          DB_SYNC_URL: file:local.db
          MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}
          MAILGUN_DOMAIN: ${{ secrets.MAILGUN_DOMAIN }}
          MAILGUN_URL: ${{ secrets.MAILGUN_URL }}
          PLAY_CRICKET_URL: ${{ secrets.PLAY_CRICKET_URL }}
          PLAY_CRICKET_API_KEY: ${{ secrets.PLAY_CRICKET_API_KEY }}
          PLAY_CRICKET_SITE_ID: ${{ secrets.PLAY_CRICKET_SITE_ID }}
          PLAY_CRICKET_1XI_ID: ${{ secrets.PLAY_CRICKET_1XI_ID }}
          PLAY_CRICKET_2XI_ID: ${{ secrets.PLAY_CRICKET_2XI_ID }}
          SLACK_TRUSTEES_HOOK: ${{ secrets.SLACK_TRUSTEES_HOOK }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: add GitHub Actions workflow for E2E tests"
```

---

### Task 9: Run full test suite locally and fix issues

**Step 1: Run all E2E tests**

Run: `npx playwright test`

**Step 2: Debug any failures**

If tests fail, run: `npx playwright test --debug` to step through visually.

Common issues to watch for:
- Stripe iframe selectors may need adjusting (inspect with debug mode)
- Email verification URL regex may need tweaking based on actual email HTML
- Timing: may need longer `waitForTimeout` or `waitForSelector` calls
- The reset password form has `id="mew-password"` (typo in original code) — tests reference this correctly

**Step 3: Fix and re-run until all tests pass**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(e2e): address test issues found during local run"
```
