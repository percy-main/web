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
