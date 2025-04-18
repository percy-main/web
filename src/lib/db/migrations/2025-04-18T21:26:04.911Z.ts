import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("event_subscriber")
    .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("meta", "json", (col) => col.notNull())
    .execute();
}
