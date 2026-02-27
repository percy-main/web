import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE UNIQUE INDEX idx_player_sponsorship_unique_paid ON player_sponsorship (contentful_entry_id, season) WHERE paid_at IS NOT NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_player_sponsorship_unique_paid`.execute(
    db,
  );
}
