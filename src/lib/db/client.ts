import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";
import { cliSafeEnv } from "../util/cliSafeEnv";
import { type DB } from "./__generated__/db";

// For deploy previews the Netlify build plugin inlines a per-PR branch
// database URL via Vite define. Falls back to the normal env var.
// The typeof check avoids a ReferenceError when running outside Vite (e.g. tsx).
declare const __BRANCH_DB_URL__: string | undefined;
const url =
  (typeof __BRANCH_DB_URL__ !== "undefined" && __BRANCH_DB_URL__) ||
  cliSafeEnv((env) => env.DB_SYNC_URL, "file:local.db");
const authToken = cliSafeEnv((env) => env.DB_TOKEN, undefined);

export const dialect = new LibsqlDialect({
  url,
  authToken,
});

export const client = new Kysely<DB>({
  dialect,
});
