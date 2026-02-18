import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("game_score")
    .addColumn("id", "text", (col) => col.primaryKey().notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("game", "text", (col) => col.notNull().defaultTo("be-the-keeper"))
    .addColumn("score", "integer", (col) => col.notNull())
    .addColumn("level", "integer", (col) => col.notNull())
    .addColumn("catches", "integer", (col) => col.notNull())
    .addColumn("best_streak", "integer", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .addUniqueConstraint("game_score_user_game_unique", ["user_id", "game"])
    .execute();
}
