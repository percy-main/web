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
 * Create (or reuse) a Turso database branched from the production DB.
 * TURSO_SEED_DB_NAME should be set to the production database name so that
 * deploy previews get realistic data.  Falls back to TURSO_DB_NAME (the
 * shared preview DB) for backward compatibility.
 * Returns the libsql:// URL for the branch, or null if branching is
 * not configured / fails.
 */
async function ensureBranchDatabase(branch) {
  const apiToken = process.env.TURSO_API_TOKEN;
  const org = process.env.TURSO_ORG;
  const parentDb = process.env.TURSO_DB_NAME;
  const seedDb = process.env.TURSO_SEED_DB_NAME || parentDb;
  const group = process.env.TURSO_GROUP || "default";

  if (!apiToken || !org || !seedDb) {
    console.log(
      "Turso branching env vars not configured (TURSO_API_TOKEN, TURSO_ORG, TURSO_SEED_DB_NAME or TURSO_DB_NAME) — using shared preview DB",
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
    console.log(
      `Reusing existing branch database: ${hostname}. ` +
        `If seeded before TURSO_SEED_DB_NAME was configured, close and reopen the PR to reseed from production.`,
    );
    return `libsql://${hostname}`;
  }

  // Create branch DB seeded from the production DB (or shared preview DB as fallback)
  console.log(`Creating branch database "${dbName}" seeded from "${seedDb}"...`);
  const createRes = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: dbName,
      group,
      seed: { type: "database", name: seedDb },
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

/**
 * Delete a Turso branch database so it can be recreated fresh.
 * Used when migrations are corrupted due to rebasing.
 */
async function deleteBranchDatabase(branch) {
  const apiToken = process.env.TURSO_API_TOKEN;
  const org = process.env.TURSO_ORG;

  if (!apiToken || !org) return false;

  const dbName = `preview-${sanitizeBranchName(branch)}`;
  const url = `https://api.turso.tech/v1/organizations/${org}/databases/${dbName}`;
  const headers = { Authorization: `Bearer ${apiToken}` };

  console.log(`Deleting corrupted branch database: ${dbName}`);
  const res = await fetch(url, { method: "DELETE", headers });

  if (res.ok) {
    console.log(`Deleted branch database: ${dbName}`);
    return true;
  }

  console.error(`Failed to delete branch database (${res.status}): ${await res.text()}`);
  return false;
}

async function getMigrationProvider() {
  console.log("Ensuring .temp directory exists");
  await mkdir(path.join(process.cwd(), ".temp")).catch(console.error);

  return {
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
  };
}

/**
 * Hash a password using better-auth's scrypt format.
 * Matches the format in better-auth/dist/crypto/password.mjs so that
 * better-auth's verifyPassword can validate it at login time.
 */
async function hashPasswordForBetterAuth(password) {
  const { scryptAsync } = await import("@noble/hashes/scrypt.js");
  const { bytesToHex } = await import("@noble/hashes/utils.js");
  const { randomBytes } = await import("node:crypto");

  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16384,
    r: 16,
    p: 1,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${bytesToHex(key)}`;
}

/**
 * Seed a test admin user into deploy preview databases so that developers
 * can log in and test admin functionality on preview deployments.
 * Credentials are configurable via PREVIEW_ADMIN_EMAIL / PREVIEW_ADMIN_PASSWORD
 * env vars, with sensible defaults.
 *
 * This is idempotent — if the user already exists, it's a no-op.
 */
async function seedPreviewAdmin(url, authToken) {
  const email =
    process.env.PREVIEW_ADMIN_EMAIL || "admin@preview.percymain.org";
  const password = process.env.PREVIEW_ADMIN_PASSWORD || "PreviewAdmin123!";

  const dialect = new LibsqlDialect({ url, authToken });
  const db = new Kysely({ dialect });

  try {
    // Check if the preview admin already exists (idempotent)
    const existing = await db
      .selectFrom("user")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (existing) {
      console.log(`Preview admin already exists (${email}) — skipping seed`);
      return;
    }

    const { randomUUID } = await import("node:crypto");
    const hashedPassword = await hashPasswordForBetterAuth(password);
    const userId = randomUUID();
    const now = new Date().toISOString();

    await db
      .insertInto("user")
      .values({
        id: userId,
        name: "Preview Admin",
        email,
        emailVerified: 1,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    await db
      .insertInto("account")
      .values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    console.log(`Preview admin seeded — email: ${email}, password: ${password}`);
  } finally {
    await db.destroy();
  }
}

async function runMigrations(url, authToken) {
  const dialect = new LibsqlDialect({ url, authToken });
  const db = new Kysely({ dialect });

  try {
    const provider = await getMigrationProvider();
    const migrator = new Migrator({ db, provider });
    const { results, error } = await migrator.migrateToLatest();

    if (error) throw error;

    results.forEach((result) => {
      console.log(
        `${result.direction} : ${result.migrationName} : ${result.status}`,
      );
    });

    return results;
  } finally {
    await db.destroy();
  }
}

export const onPreBuild = async ({ utils, netlifyConfig }) => {
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
        // BRANCH_DB_URL is read by the Vite `define` in astro.config.mjs
        // and inlined into the server bundle at build time, so the deployed
        // function uses the branch DB instead of the shared preview DB.
        netlifyConfig.build.environment.BRANCH_DB_URL = branchUrl;
        console.log(`Deploy preview will use branch database: ${branchUrl}`);
      }
    }

    let results;
    try {
      results = await runMigrations(url, authToken);
    } catch (error) {
      // On deploy previews, "corrupted migrations" means the branch DB
      // was created before a rebase changed the migration order. Delete
      // and recreate the branch DB to fix it.
      const isCorrupted =
        error?.message?.includes("corrupted migrations") &&
        context === "deploy-preview" &&
        branch;

      if (isCorrupted) {
        console.log(
          "Migration corruption detected on deploy preview — recreating branch database",
        );
        const deleted = await deleteBranchDatabase(branch);
        if (deleted) {
          const freshUrl = await ensureBranchDatabase(branch);
          if (freshUrl) {
            url = freshUrl;
            netlifyConfig.build.environment.BRANCH_DB_URL = freshUrl;
            results = await runMigrations(url, authToken);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const failures = (results ?? []).filter((r) => r.status === "Error");

    // Seed a test admin user on deploy previews so developers can log in
    if (context === "deploy-preview" && !failures.length) {
      try {
        await seedPreviewAdmin(url, authToken);
      } catch (seedError) {
        // Non-fatal — log but don't fail the build
        console.error("Failed to seed preview admin user:", seedError);
      }
    }

    utils.status.show({
      title: "DB Migrations",
      summary: failures.length
        ? "Some migrations failed"
        : "Migrations succeeded",
      text: (results ?? [])
        .map((r) => `${r.migrationName} : ${r.status}`)
        .join("\r\n"),
    });
  } catch (error) {
    console.error(error);
    utils.build.failBuild("Migrations failed", { error });
  }
};
