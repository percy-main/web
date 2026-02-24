import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";
import { mkdir } from "fs/promises";
import { join } from "path";

const TEST_EMAIL_PREFIX = "test-e2e";

export default async function globalSetup() {
  const db = new Kysely<Record<string, Record<string, unknown>>>({
    dialect: new LibsqlDialect({
      url: process.env.DB_SYNC_URL ?? "file:local.db",
      authToken: process.env.DB_TOKEN ?? undefined,
    }),
  });

  try {
    // Delete test users and their related data
    const testUsers = await db
      .selectFrom("user")
      .select("id")
      .where("email", "like", `${TEST_EMAIL_PREFIX}%`)
      .execute();

    const userIds = testUsers.map((u) => u.id as string);

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
