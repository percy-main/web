import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("member")
    .addColumn("play_cricket_id", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("play_cricket_id", "text")
    .execute();
}
