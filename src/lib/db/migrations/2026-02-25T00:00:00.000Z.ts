import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("charge")
    .addColumn("id", "text", (col) => col.primaryKey().notNull())
    .addColumn("member_id", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("amount_pence", "integer", (col) => col.notNull())
    .addColumn("charge_date", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("paid_at", "text")
    .addColumn("stripe_payment_intent_id", "text")
    .addColumn("created_by", "text", (col) => col.notNull())
    .addColumn("deleted_at", "text")
    .addColumn("deleted_by", "text")
    .addColumn("deleted_reason", "text")
    .execute();
}
