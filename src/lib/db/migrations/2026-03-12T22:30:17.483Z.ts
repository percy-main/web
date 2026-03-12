import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("fantasy_player_score")
    .addColumn("stumpings", "integer", (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("fantasy_player_score")
    .dropColumn("stumpings")
    .execute();
}
