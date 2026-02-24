/* eslint-disable react-hooks/rules-of-hooks */
import { test as playwrightTest } from "@playwright/test";
import { type ChildProcess, spawn } from "child_process";
import { mkdirSync, rmSync, promises as fs } from "fs";
import { createServer } from "net";
import { join } from "path";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import * as path from "path";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Could not get port"));
        return;
      }
      const { port } = addr;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`Server at ${url} not ready after ${timeoutMs}ms`);
}

function killProcess(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!proc.pid) {
      resolve();
      return;
    }
    proc.on("close", () => resolve());
    proc.kill("SIGTERM");
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already dead */
      }
      resolve();
    }, 5000);
  });
}

async function createFreshDb(dbFile: string): Promise<void> {
  const db = new Kysely<Record<string, Record<string, unknown>>>({
    dialect: new LibsqlDialect({ url: `file:${dbFile}` }),
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
    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw new Error(
        `Migration failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  } finally {
    await db.destroy();
  }
}

/**
 * Base fixture: each test gets its own dev server, DB file, and email directory.
 * Overrides Playwright's built-in baseURL so page.goto("/foo") hits the right server.
 */
export const test = playwrightTest.extend({
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, use) => {
    const testId = Math.random().toString(36).slice(2, 8);
    const dbFile = join(process.cwd(), `e2e-test-${testId}.db`);
    const emailDir = join(process.cwd(), `.emails-${testId}`);
    const dbUrl = `file:${dbFile}`;

    await createFreshDb(dbFile);
    mkdirSync(emailDir, { recursive: true });

    // Make paths available to test code that connects directly (e.g. auth fixture, email helper)
    process.env.DB_SYNC_URL = dbUrl;
    process.env.EMAIL_DIR = emailDir;

    const port = await getFreePort();
    const url = `http://localhost:${port}`;

    const server = spawn("npx", ["astro", "dev", "--port", String(port)], {
      env: {
        ...process.env,
        DB_SYNC_URL: dbUrl,
        BASE_URL: url,
        BETTER_AUTH_URL: url,
        EMAIL_DIR: emailDir,
      },
      cwd: process.cwd(),
      stdio: "pipe",
    });

    await waitForServer(url);

    await use(url);

    await killProcess(server);
    rmSync(dbFile, { force: true });
    rmSync(`${dbFile}-wal`, { force: true });
    rmSync(`${dbFile}-shm`, { force: true });
    rmSync(emailDir, { recursive: true, force: true });
  },
});

export { expect } from "@playwright/test";
