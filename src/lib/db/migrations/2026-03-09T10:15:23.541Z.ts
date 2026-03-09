import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // ── team_official: links users to play_cricket_team entries ──
  await db.schema
    .createTable("team_official")
    .addColumn("user_id", "text", (col) => col.notNull().references("user.id"))
    .addColumn("play_cricket_team_id", "text", (col) =>
      col.notNull().references("play_cricket_team.id"),
    )
    .addPrimaryKeyConstraint("team_official_pk", [
      "user_id",
      "play_cricket_team_id",
    ])
    .execute();

  await sql`CREATE INDEX idx_team_official_user ON team_official(user_id)`.execute(
    db,
  );

  // ── matchday: one record per fixture ──
  await db.schema
    .createTable("matchday")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("play_cricket_team_id", "text", (col) =>
      col.notNull().references("play_cricket_team.id"),
    )
    .addColumn("match_date", "text", (col) => col.notNull())
    .addColumn("opposition", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("confirmed_at", "text")
    .addColumn("confirmed_by", "text", (col) => col.references("user.id"))
    .addColumn("finished_at", "text")
    .addColumn("finished_by", "text", (col) => col.references("user.id"))
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("created_by", "text", (col) =>
      col.notNull().references("user.id"),
    )
    .execute();

  await sql`CREATE INDEX idx_matchday_team_date ON matchday(play_cricket_team_id, match_date)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_matchday_status ON matchday(status)`.execute(db);

  // ── matchday_player: player selections for a matchday ──
  await db.schema
    .createTable("matchday_player")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("matchday_id", "text", (col) =>
      col.notNull().references("matchday.id"),
    )
    .addColumn("member_id", "text", (col) => col.references("member.id"))
    .addColumn("player_name", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("selected"))
    .addColumn("replaced_by_matchday_player_id", "text", (col) =>
      col.references("matchday_player.id"),
    )
    .addColumn("charge_id", "text", (col) => col.references("charge.id"))
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE INDEX idx_matchday_player_matchday ON matchday_player(matchday_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_matchday_player_member ON matchday_player(member_id)`.execute(
    db,
  );

  // ── match_fee_rate: fee schedule (team × competition_type × member_category → amount) ──
  await db.schema
    .createTable("match_fee_rate")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("play_cricket_team_id", "text", (col) =>
      col.references("play_cricket_team.id"),
    )
    .addColumn("competition_type", "text")
    .addColumn("member_category", "text", (col) => col.notNull())
    .addColumn("amount_pence", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await sql`CREATE INDEX idx_match_fee_rate_lookup ON match_fee_rate(play_cricket_team_id, competition_type, member_category)`.execute(
    db,
  );

  // ── Add payment_method to charge table ──
  await db.schema
    .alterTable("charge")
    .addColumn("payment_method", "text")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  // Drop indexes first
  await sql`DROP INDEX IF EXISTS idx_team_official_user`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_matchday_team_date`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_matchday_status`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_matchday_player_matchday`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_matchday_player_member`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_match_fee_rate_lookup`.execute(db);

  // Drop tables in reverse dependency order
  await db.schema.dropTable("match_fee_rate").ifExists().execute();
  await db.schema.dropTable("matchday_player").ifExists().execute();
  await db.schema.dropTable("matchday").ifExists().execute();
  await db.schema.dropTable("team_official").ifExists().execute();

  // Remove payment_method from charge
  await db.schema
    .alterTable("charge")
    .dropColumn("payment_method")
    .execute();
}
