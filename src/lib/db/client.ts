import { LibsqlDialect } from "@libsql/kysely-libsql";

export const client = new LibsqlDialect({
  url: import.meta.env.DB_SYNC_URL as string,
  authToken: import.meta.env.DB_TOKEN as string,
});
