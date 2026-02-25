import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("charge")
    .addColumn("payment_confirmed_at", "text")
    .execute();
}
