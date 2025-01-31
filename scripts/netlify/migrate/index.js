/* eslint-disable */
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { promises as fs } from "fs";
import { readFile, writeFile } from "fs/promises";
import { Kysely, Migrator } from "kysely";
import * as path from "path";
import ts from "typescript";

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
      provider: {
        getMigrations: async () => {
          const migrationDir = path.join(
            process.cwd(),
            "./src/lib/db/migrations",
          );

          console.log(`Looking for migrations in ${migrationDir}`);
          const files = await fs.readdir(migrationDir);
          console.log(`Found ${files.length} migrations`);

          const migrations = await Promise.all(
            files.map(async (filename) => {
              console.log(`${filename} : Reading`);
              const tsContent = await readFile(
                path.join(migrationDir, filename),
                "utf-8",
              );
              console.log(`${filename} : Transpiling TS -> JS`);
              const jsFileContent = ts.transpile(tsContent, {
                module: "ESNext",
                target: "ESNext",
              });

              const jsFilepath = path.join(
                process.cwd(),
                ".temp",
                `${filename.substring(0, filename.length - 2)}.mjs`,
              );
              console.log(`${filename} : Writing JS to ${jsFilepath}`);
              await writeFile(jsFilepath, jsFileContent);

              console.log(`${filename} : Importing compiled JS module`);
              const migration = await import(jsFilepath);
              return [filename, migration];
            }),
          );

          return Object.fromEntries(migrations);
        },
      },
    });

    const { results, error } = await migrator.migrateToLatest();

    if (error) {
      throw error;
    }

    const failures = results.filter((r) => r.status === "Error");

    results.forEach((result) => {
      console.log(
        `${result.direction} : ${result.migrationName} : ${result.status}`,
      );
    });

    utils.status.show({
      title: "DB Migrations",
      summary: failures.length
        ? "Some migrations failed"
        : "Migrations succeeded",
      text: results.map((r) => `${r.migrationName} : ${r.status}`).join("\r\n"),
    });
  } catch (error) {
    console.error(error);
    utils.build.failBuild("Migrations failed", { error });
  } finally {
    await db?.destroy();
  }
};
