import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS member_email_unique ON member(email)`.execute(db);
}
