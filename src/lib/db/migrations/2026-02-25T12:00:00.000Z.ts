import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("dependent")
    .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
    .addColumn("member_id", "uuid", (col) =>
      col.notNull().references("member.id"),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("sex", "text", (col) => col.notNull())
    .addColumn("dob", "text", (col) => col.notNull())
    .addColumn("created_at", "date", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await db.schema
    .alterTable("membership")
    .addColumn("dependent_id", "uuid", (col) => col.references("dependent.id"))
    .execute();
}
