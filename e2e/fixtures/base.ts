import { test as playwrightTest } from "@playwright/test";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely, sql } from "kysely";

/**
 * Base test fixture that resets the database before every test.
 * All test files should import { test } from this module (or from auth.ts
 * which extends it) to get a fresh DB for each test.
 */
export const test = playwrightTest.extend<{ resetDb: undefined }>({
  // eslint-disable-next-line react-hooks/rules-of-hooks
  resetDb: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const db = new Kysely<Record<string, Record<string, unknown>>>({
        dialect: new LibsqlDialect({
          url: process.env.DB_SYNC_URL ?? "file:local.db",
          authToken: process.env.DB_TOKEN ?? undefined,
        }),
      });

      try {
        // Delete in FK-safe order: children first, then parents
        await sql`DELETE FROM session`.execute(db);
        await sql`DELETE FROM account`.execute(db);
        await sql`DELETE FROM verification`.execute(db);
        await sql`DELETE FROM passkey`.execute(db);
        await sql`DELETE FROM "twoFactor"`.execute(db);
        await sql`DELETE FROM membership`.execute(db);
        await sql`DELETE FROM member`.execute(db);
        await sql`DELETE FROM event_subscriber`.execute(db);
        await sql`DELETE FROM game_score`.execute(db);
        await sql`DELETE FROM user`.execute(db);
      } finally {
        await db.destroy();
      }

      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
