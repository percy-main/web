import { expect, test } from "../fixtures/base";

test.describe("Navigation & Content Pages", () => {
  const sportPages = ["/cricket", "/football", "/boxing", "/running"];

  for (const path of sportPages) {
    test(`${path} loads successfully`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).not.toBeEmpty();
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
