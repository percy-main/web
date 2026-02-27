import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Replace the non-unique index with a unique one.
  // play_cricket_id should be unique per member (nullable, but unique when set).
  await sql`DROP INDEX IF EXISTS idx_member_play_cricket_id`.execute(db);
  await sql`CREATE UNIQUE INDEX idx_member_play_cricket_id ON member(play_cricket_id) WHERE play_cricket_id IS NOT NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_member_play_cricket_id`.execute(db);
  await sql`CREATE INDEX idx_member_play_cricket_id ON member(play_cricket_id)`.execute(
    db,
  );
}
