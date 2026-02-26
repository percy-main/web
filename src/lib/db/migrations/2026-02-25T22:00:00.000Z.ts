import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("charge")
    .addColumn("type", "text", (col) => col.notNull().defaultTo("manual"))
    .execute();

  await db.schema
    .alterTable("charge")
    .addColumn("source", "text", (col) => col.notNull().defaultTo("admin"))
    .execute();
}
