import { type Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("fantasy_player")
    .addColumn("sandwich_cost", "integer", (col) => col.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("fantasy_player")
    .dropColumn("sandwich_cost")
    .execute();
}
