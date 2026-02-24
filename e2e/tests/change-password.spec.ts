import { test as authTest, expect } from "../fixtures/auth";

authTest.describe("Change Password", () => {
  authTest(
    "changes password successfully with correct current password",
    async ({ authenticatedPage, testUser }) => {
      const newPassword = "NewSecurePass456!";

      await authenticatedPage.goto("/members");
      await expect(
        authenticatedPage.getByText("Members Area"),
      ).toBeVisible();

      // Navigate to Security tab
      await authenticatedPage
        .getByRole("tab", { name: "Security" })
        .click();

      // Fill in the change password form
      await authenticatedPage
        .locator("#current-password")
        .fill(testUser.password);
      await authenticatedPage.locator("#new-password").fill(newPassword);
      await authenticatedPage
        .locator("#confirm-password")
        .fill(newPassword);

      // Submit
      await authenticatedPage
        .getByRole("button", { name: "Change Password" })
        .click();

      // Should show success message
      await expect(
        authenticatedPage.getByText(
          "Your password has been changed successfully.",
        ),
      ).toBeVisible({ timeout: 10_000 });

      // Log out
      await authenticatedPage.goto("/auth/logout");
      await authenticatedPage.waitForURL("/");

      // Log in with new password
      await authenticatedPage.goto("/auth/login");
      await authenticatedPage.locator("#email").fill(testUser.email);
      await authenticatedPage.locator("#password").fill(newPassword);
      await authenticatedPage
        .locator('button[type="submit"]')
        .click();

      await authenticatedPage.waitForURL(/\/members/);
      await expect(
        authenticatedPage.getByText("Members Area"),
      ).toBeVisible();
    },
  );

  authTest(
    "shows validation error when new passwords do not match",
    async ({ authenticatedPage, testUser }) => {
      await authenticatedPage.goto("/members");
      await expect(
        authenticatedPage.getByText("Members Area"),
      ).toBeVisible();

      // Navigate to Security tab
      await authenticatedPage
        .getByRole("tab", { name: "Security" })
        .click();

      // Fill in mismatched passwords
      await authenticatedPage
        .locator("#current-password")
        .fill(testUser.password);
      await authenticatedPage
        .locator("#new-password")
        .fill("NewPassword123!");
      await authenticatedPage
        .locator("#confirm-password")
        .fill("DifferentPassword456!");

      // Submit
      await authenticatedPage
        .getByRole("button", { name: "Change Password" })
        .click();

      // Should show validation error
      await expect(
        authenticatedPage.getByText("New passwords do not match."),
      ).toBeVisible();
    },
  );

  authTest(
    "shows error when current password is wrong",
    async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/members");
      await expect(
        authenticatedPage.getByText("Members Area"),
      ).toBeVisible();

      // Navigate to Security tab
      await authenticatedPage
        .getByRole("tab", { name: "Security" })
        .click();

      // Fill in wrong current password
      await authenticatedPage
        .locator("#current-password")
        .fill("WrongPassword999!");
      await authenticatedPage
        .locator("#new-password")
        .fill("NewPassword123!");
      await authenticatedPage
        .locator("#confirm-password")
        .fill("NewPassword123!");

      // Submit
      await authenticatedPage
        .getByRole("button", { name: "Change Password" })
        .click();

      // Should show server error (better-auth returns an error for wrong current password)
      await expect(
        authenticatedPage.locator("text=Invalid password").first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );
});
