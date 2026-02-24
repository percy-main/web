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
