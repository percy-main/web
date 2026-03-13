import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE dependent ADD COLUMN user_id TEXT REFERENCES user(id)`.execute(
    db,
  );
}
