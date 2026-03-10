import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("matchday_expense")
    .addColumn("receipt_image_url", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("matchday_expense")
    .dropColumn("receipt_image_url")
    .execute();
}
