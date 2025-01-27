import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("membership")
    .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
    .addColumn("member_id", "uuid", (col) =>
      col.notNull().references("member.id"),
    )
    .addColumn("paid_until", "date", (col) => col.notNull())
    .addColumn("created_at", "date", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}
