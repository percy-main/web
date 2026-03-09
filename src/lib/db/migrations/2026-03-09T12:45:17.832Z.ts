import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("matchday")
    .addColumn("competition_type", "text")
    .execute();
}
