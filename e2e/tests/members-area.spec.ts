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
