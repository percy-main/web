import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
        alter table "user" add column "role" text;
    `.execute(db);
  await sql`
        alter table "user" add column "banned" integer;
    `.execute(db);
  await sql`
        alter table "user" add column "banReason" text;
    `.execute(db);
  await sql`
        alter table "user" add column "banExpires" date;
    `.execute(db);
  await sql`
        alter table "session" add column "impersonatedBy" text
    `.execute(db);
}
