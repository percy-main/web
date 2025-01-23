import { LibsqlDialect } from "@libsql/kysely-libsql";
import { cliSafeEnv } from "../util/cliSafeEnv";

const url = await cliSafeEnv((env) => env.DB_SYNC_URL, "file:local.db");
const authToken = await cliSafeEnv((env) => env.DB_TOKEN, undefined);

export const dialect = new LibsqlDialect({
  url,
  authToken,
});
