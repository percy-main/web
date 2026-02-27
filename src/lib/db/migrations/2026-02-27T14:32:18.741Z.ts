import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // ── Leaderboard queries (public, hot path) ──
  // Covers: WHERE season = ? AND team_id = ? [AND competition_type IN (?)]
  await sql`CREATE INDEX idx_batting_season_team ON match_performance_batting(season, team_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_bowling_season_team ON match_performance_bowling(season, team_id)`.execute(
    db,
  );
  // Covers: WHERE player_id = ? (career stats, season stats)
  await sql`CREATE INDEX idx_batting_player ON match_performance_batting(player_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_bowling_player ON match_performance_bowling(player_id)`.execute(
    db,
  );

  // ── Sponsorship lookups (public pages) ──
  // Covers: WHERE game_id = ? AND approved = 1 AND paid_at IS NOT NULL
  await sql`CREATE INDEX idx_game_sponsorship_game ON game_sponsorship(game_id)`.execute(
    db,
  );
  // Covers: WHERE contentful_entry_id = ? AND season = ? (general lookup)
  await sql`CREATE INDEX idx_player_sponsorship_lookup ON player_sponsorship(contentful_entry_id, season)`.execute(
    db,
  );

  // ── Admin sponsorship lists ──
  await sql`CREATE INDEX idx_game_sponsorship_created ON game_sponsorship(created_at DESC)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_player_sponsorship_created ON player_sponsorship(created_at DESC)`.execute(
    db,
  );

  // ── Member relations (authenticated paths) ──
  await sql`CREATE INDEX idx_dependent_member ON dependent(member_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_charge_member ON charge(member_id)`.execute(db);
  await sql`CREATE INDEX idx_charge_stripe_pi ON charge(stripe_payment_intent_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_membership_member ON membership(member_id)`.execute(
    db,
  );

  // ── Access control (hot path, every page load for managers) ──
  await sql`CREATE INDEX idx_junior_team_mgr_user ON junior_team_manager(user_id)`.execute(
    db,
  );

  // ── Game scores ──
  await sql`CREATE INDEX idx_game_score_user_game ON game_score(user_id, game)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_game_score_leaderboard ON game_score(game, score DESC)`.execute(
    db,
  );

  // ── Join tables ──
  await sql`CREATE INDEX idx_charge_dependent_charge ON charge_dependent(charge_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_charge_dependent_dependent ON charge_dependent(dependent_id)`.execute(
    db,
  );

  // ── Session (better-auth token is already UNIQUE; add userId lookup) ──
  await sql`CREATE INDEX idx_session_user ON session(userId)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_batting_season_team`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_bowling_season_team`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_batting_player`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_bowling_player`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_game_sponsorship_game`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_player_sponsorship_lookup`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_game_sponsorship_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_player_sponsorship_created`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_dependent_member`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_charge_member`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_charge_stripe_pi`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_membership_member`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_junior_team_mgr_user`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_game_score_user_game`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_game_score_leaderboard`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_charge_dependent_charge`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_charge_dependent_dependent`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_session_user`.execute(db);
}
