import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add play_cricket_match_id to matchday for linking to game sponsorships
  await db.schema
    .alterTable("matchday")
    .addColumn("play_cricket_match_id", "text")
    .execute();

  // Create matchday_expense table
  await db.schema
    .createTable("matchday_expense")
    .addColumn("id", "text", (col) => col.primaryKey().notNull())
    .addColumn("matchday_id", "text", (col) =>
      col.notNull().references("matchday.id"),
    )
    .addColumn("expense_type", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("amount_pence", "integer", (col) => col.notNull())
    .addColumn("created_by", "text", (col) =>
      col.notNull().references("user.id"),
    )
    .addColumn("created_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("matchday_expense").execute();
  await db.schema
    .alterTable("matchday")
    .dropColumn("play_cricket_match_id")
    .execute();
}
