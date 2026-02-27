import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("player_sponsorship")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("contentful_entry_id", "text", (col) => col.notNull())
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("season", "integer", (col) => col.notNull())
    .addColumn("stripe_payment_intent_id", "text")
    .addColumn("paid_at", "text")
    .addColumn("sponsor_name", "text", (col) => col.notNull())
    .addColumn("sponsor_email", "text", (col) => col.notNull())
    .addColumn("sponsor_website", "text")
    .addColumn("sponsor_logo_url", "text")
    .addColumn("sponsor_message", "text")
    .addColumn("approved", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("display_name", "text")
    .addColumn("amount_pence", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("notes", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("player_sponsorship").execute();
}
