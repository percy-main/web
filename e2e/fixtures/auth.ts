/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from "@playwright/test";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";

type AuthFixtures = {
  authenticatedPage: Page;
  testUser: { email: string; password: string; name: string };
};

export const test = base.extend<AuthFixtures>({
  // eslint-disable-next-line no-empty-pattern
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
    const db = new Kysely<Record<string, Record<string, unknown>>>({
      dialect: new LibsqlDialect({
        url: process.env.DB_SYNC_URL ?? "file:local.db",
        authToken: process.env.DB_TOKEN ?? undefined,
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
