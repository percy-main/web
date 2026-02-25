/* eslint-disable */
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { promises as fs } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { Kysely, Migrator } from "kysely";
import * as path from "path";
import ts from "typescript";

/**
 * Sanitise a git branch name into a valid Turso database name.
 * Turso names: lowercase alphanumeric + hyphens, max 64 chars.
 * We prefix with "preview-" (8 chars) so the branch part is capped at 46.
 */
function sanitizeBranchName(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 46);
}

/**
 * Create (or reuse) a Turso database branched from the deploy-preview DB.
 * TURSO_DB_NAME should be set to the shared preview database name.
 * Returns the libsql:// URL for the branch, or null if branching is
 * not configured / fails.
 */
async function ensureBranchDatabase(branch) {
  const apiToken = process.env.TURSO_API_TOKEN;
  const org = process.env.TURSO_ORG;
  const parentDb = process.env.TURSO_DB_NAME;
  const group = process.env.TURSO_GROUP || "default";

  if (!apiToken || !org || !parentDb) {
    console.log(
      "Turso branching env vars not configured (TURSO_API_TOKEN, TURSO_ORG, TURSO_DB_NAME) — using shared preview DB",
    );
    return null;
  }

  const dbName = `preview-${sanitizeBranchName(branch)}`;
  const baseUrl = `https://api.turso.tech/v1/organizations/${org}/databases`;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  // Check if branch DB already exists
  console.log(`Checking for existing branch database: ${dbName}`);
  const checkRes = await fetch(`${baseUrl}/${dbName}`, { headers });

  if (checkRes.ok) {
    const data = await checkRes.json();
    const hostname = data.database?.Hostname || data.database?.hostname;
    console.log(`Reusing existing branch database: ${hostname}`);
    return `libsql://${hostname}`;
  }

  // Create branch DB seeded from the shared deploy-preview DB
  console.log(`Creating branch database "${dbName}" from "${parentDb}"...`);
  const createRes = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: dbName,
      group,
      seed: { type: "database", name: parentDb },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(
      `Failed to create branch database (${createRes.status}): ${errText}`,
    );
    return null;
  }

  const data = await createRes.json();
  const hostname = data.database?.Hostname || data.database?.hostname;

  if (!hostname) {
    console.error(
      "Branch database created but no hostname in response:",
      JSON.stringify(data),
    );
    return null;
  }

  console.log(`Created branch database: ${hostname}`);
  return `libsql://${hostname}`;
}

export const onPreBuild = async ({ utils, netlifyConfig }) => {
  let db;
  try {
    let url = process.env.DB_SYNC_URL;
    const authToken = process.env.DB_TOKEN;

    if (!url) {
      throw new Error("DB_SYNC_URL not set");
    }

    if (!authToken) {
      throw new Error("DB_TOKEN not set");
    }

    // For deploy previews, create/reuse a per-PR branch database so that
    // migrations from different PRs can't interfere with each other.
    const context = process.env.CONTEXT;
    const branch = process.env.BRANCH;

    if (context === "deploy-preview" && branch) {
      const branchUrl = await ensureBranchDatabase(branch);
      if (branchUrl) {
        url = branchUrl;
        // Propagate to the Astro build so the app uses the branch DB too
        netlifyConfig.build.environment.DB_SYNC_URL = branchUrl;
        console.log(`Deploy preview will use branch database: ${branchUrl}`);
      }
    }

    const dialect = new LibsqlDialect({
      url,
      authToken,
    });

    db = new Kysely({
      dialect,
    });

    console.log("Ensuring .temp directory exists");
    await mkdir(path.join(process.cwd(), ".temp")).catch(console.error);

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
