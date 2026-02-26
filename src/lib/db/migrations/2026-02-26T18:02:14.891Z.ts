import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("play_cricket_match_cache")
    .addColumn("match_id", "text", (col) => col.primaryKey())
    .addColumn("data", "text", (col) => col.notNull())
    .addColumn("fetched_at", "text", (col) => col.notNull())
    .addColumn("match_date", "text", (col) => col.notNull())
    .execute();
}
