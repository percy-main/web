import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely } from "kysely";
import { cliSafeEnv } from "../util/cliSafeEnv";
import { type DB } from "./__generated__/db";

const url = cliSafeEnv((env) => env.DB_SYNC_URL, "file:local.db");
const authToken = cliSafeEnv((env) => env.DB_TOKEN, undefined);

export const dialect = new LibsqlDialect({
  url,
  authToken,
});

export const client = new Kysely<DB>({
  dialect,
});
