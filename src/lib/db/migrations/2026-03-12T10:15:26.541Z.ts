import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // Reset existing 2026 fantasy teams so everyone re-picks under new constraints
  await sql`DELETE FROM fantasy_team_score WHERE season = '2026'`.execute(db);
  await sql`DELETE FROM fantasy_team_player WHERE fantasy_team_id IN (SELECT id FROM fantasy_team WHERE season = '2026')`.execute(db);
  await sql`DELETE FROM fantasy_team WHERE season = '2026'`.execute(db);
}

export async function down(): Promise<void> {
  // Data deletion is not reversible
}
