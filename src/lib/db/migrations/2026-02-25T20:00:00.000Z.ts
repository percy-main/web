import type { Kysely } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await db.schema
    .alterTable("member")
    .addColumn("stripe_customer_id", "text")
    .execute();
}
