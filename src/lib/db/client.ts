import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";
import { cliSafeEnv } from "../util/cliSafeEnv";
import { type DB } from "./__generated__/db";

declare const __BRANCH_DB_URL__: string;

// For deploy previews the Netlify build plugin inlines a per-PR branch
// database URL via Vite define. Falls back to the normal env var.
const url =
  __BRANCH_DB_URL__ || cliSafeEnv((env) => env.DB_SYNC_URL, "file:local.db");
const authToken = cliSafeEnv((env) => env.DB_TOKEN, undefined);

export const dialect = new LibsqlDialect({
  url,
  authToken,
});

export const client = new Kysely<DB>({
  dialect,
});
