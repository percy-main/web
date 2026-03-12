import { type Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("fantasy_team_player")
    .addColumn("slot_type", "text", (col) => col.notNull().defaultTo("batting"))
    .execute();

  await db.schema
    .alterTable("fantasy_team_player")
    .addColumn("is_wicketkeeper", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("fantasy_team_player")
    .dropColumn("slot_type")
    .execute();

  await db.schema
    .alterTable("fantasy_team_player")
    .dropColumn("is_wicketkeeper")
    .execute();
}
