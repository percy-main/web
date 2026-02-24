import { expect, test } from "../fixtures/base";
import { test as authTest } from "../fixtures/auth";
import {
  extractResetUrl,
  extractVerificationUrl,
  getLatestEmail,
} from "../helpers/email";

test.describe("Registration + Email Verification + Login", () => {
  const testPassword = "TestPassword123!";

  test("full registration flow", async ({ page }) => {
    const testEmail = `test-e2e-reg-${Date.now()}@example.com`;

    // 1. Go to registration with pre-filled name/email
    await page.goto(
      `/auth/register?name=Test+E2E+User&email=${encodeURIComponent(testEmail)}`,
    );

    // 2. Wait for React hydration (name/email are client:only="react" hidden inputs)
    await page.locator("#name").waitFor({ state: "attached" });

    // 3. Fill password and submit
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // 4. Should land on /auth/registered
    await expect(page).toHaveURL(/\/auth\/registered/, { timeout: 10_000 });
    await expect(page.getByText("Thanks for joining!")).toBeVisible();

    // 5. Read verification email
    await page.waitForTimeout(2000);
    const { html } = await getLatestEmail();
    const verificationUrl = extractVerificationUrl(html);

    // 6. Visit verification URL
    await page.goto(verificationUrl);
    await page.waitForURL(/\/auth\/email-confirmed/);

    // 7. Go to login, fill credentials
    await page.goto("/auth/login");
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // 8. Should redirect to /members
    await page.waitForURL(/\/members/);
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

  test("forgot password flow", async ({ page }) => {
    // Seed a verified user for this test
    await page.request.post("/api/auth/sign-up/email", {
      data: {
        name: "Forgot Test User",
        email: testEmail,
        password: originalPassword,
      },
    });

    const { LibsqlDialect } = await import("@libsql/kysely-libsql");
    const { Kysely } = await import("kysely");
    const db = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new LibsqlDialect({
        url: process.env.DB_SYNC_URL ?? "file:local.db",
        authToken: process.env.DB_TOKEN ?? undefined,
      }),
    });
    await db
      .updateTable("user")
      .set({ emailVerified: 1 })
      .where("email", "=", testEmail)
      .execute();
    await db.destroy();

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

    // 4. Read reset email (the sign-up verification email is also in the dir,
    //    but reset email comes later so it's the "latest")
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

    await page.waitForURL(/\/members/);
    await expect(page.getByText("Members Area")).toBeVisible();
  });
});
