/* eslint-disable */
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { promises as fs } from "fs";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import * as path from "path";

export const onPostBuild = async ({ utils }) => {
  let db;
  try {
    const url = process.env.DB_SYNC_URL;
    const authToken = process.env.DB_TOKEN;

    if (!url) {
      throw new Error("DB_SYNC_URL not set");
    }

    if (!authToken) {
      throw new Error("DB_TOKEN not set");
    }

    const dialect = new LibsqlDialect({
      url,
      authToken,
    });

    db = new Kysely({
      dialect,
    });

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.join(process.cwd(), "./src/lib/db/migrations"),
      }),
    });

    const { results, error } = await migrator.migrateToLatest();

    if (error) {
      throw error;
    }

    const failures = results.filter((r) => r.status === "Error");

    utils.status.show({
      title: "DB Migrations",
      summary: failures.length
        ? "Some migrations failed"
        : "Migrations succeeded",
      text: results.map((r) => `${r.migrationName} : ${r.status}`),
    });
  } catch (error) {
    console.error(error);
    utils.build.failBuild("Migrations failed", { error });
  } finally {
    await db?.destroy();
  }
};
