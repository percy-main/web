import { LibsqlDialect } from "@libsql/kysely-libsql";
import { cliSafeEnv } from "../util/cliSafeEnv";
import { Kysely } from "kysely";
import { type DB } from "./__generated__/db";

const url = await cliSafeEnv((env) => env.DB_SYNC_URL, "file:local.db");
const authToken = await cliSafeEnv((env) => env.DB_TOKEN, undefined);

export const dialect = new LibsqlDialect({
  url,
  authToken,
});

export const client = new Kysely<DB>({
  dialect,
});
