import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("member")
    .addColumn("deleted_at", "text")
    .execute();
  await db.schema
    .alterTable("member")
    .addColumn("deleted_by", "text")
    .execute();
  await db.schema
    .alterTable("member")
    .addColumn("deleted_reason", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("member").dropColumn("deleted_at").execute();
  await db.schema.alterTable("member").dropColumn("deleted_by").execute();
  await db.schema.alterTable("member").dropColumn("deleted_reason").execute();
}
