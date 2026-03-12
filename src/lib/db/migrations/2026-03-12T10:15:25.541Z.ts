import { type Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("fantasy_player_score")
    .addColumn("catches", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .alterTable("fantasy_player_score")
    .addColumn("is_actual_keeper", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("fantasy_player_score")
    .dropColumn("catches")
    .execute();

  await db.schema
    .alterTable("fantasy_player_score")
    .dropColumn("is_actual_keeper")
    .execute();
}
