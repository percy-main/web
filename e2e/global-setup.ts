import { LibsqlDialect } from "@libsql/kysely-libsql";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import { promises as fs } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import * as path from "path";

export default async function globalSetup() {
  // Run migrations to ensure DB schema exists (needed for fresh CI databases)
  const db = new Kysely<Record<string, Record<string, unknown>>>({
    dialect: new LibsqlDialect({
      url: process.env.DB_SYNC_URL ?? "file:local.db",
      authToken: process.env.DB_TOKEN ?? undefined,
    }),
  });

  try {
    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: join(process.cwd(), "src/lib/db/migrations"),
      }),
    });
    const { error, results } = await migrator.migrateToLatest();
    results?.forEach((r) => {
      if (r.status === "Success") {
        console.log(`migration "${r.migrationName}" executed successfully`);
      }
    });
    if (error) {
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  } finally {
    await db.destroy();
  }

  // Ensure .emails directory exists
  await mkdir(join(process.cwd(), ".emails"), { recursive: true });
}
