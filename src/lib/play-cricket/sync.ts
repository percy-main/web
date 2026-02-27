import { createClient } from "@libsql/client/http";
import { z } from "zod";
import {
  GetMatchDetailResponse,
  GetMatchSummaryResponse,
  GetTeamsResponse,
} from "./schemas";

// --- Helpers ---

async function fetchApi(url: string, label: string): Promise<unknown> {
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `${label} failed (HTTP ${res.status}): ${body.slice(0, 500)}`,
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(
      `${label} returned non-JSON (HTTP ${res.status}): ${body.slice(0, 500)}`,
    );
  }
}

const JUNIOR_PATTERNS = [/under/i, /\bU\d{2}\b/, /junior/i, /colts/i];

function isJuniorTeam(teamName: string): boolean {
  return JUNIOR_PATTERNS.some((p) => p.test(teamName));
}

function randomId(): string {
  return crypto.randomUUID();
}

const NOT_OUT_CODES = new Set(["no", "dnb", "rtd", ""]);

function isNotOut(howOut: string): boolean {
  return NOT_OUT_CODES.has(howOut.toLowerCase().trim());
}

function didBat(howOut: string): boolean {
  const code = howOut.toLowerCase().trim();
  return code !== "dnb" && code !== "";
}

// --- Types ---

type DbClient = ReturnType<typeof createClient>;

interface SyncConfig {
  apiKey: string;
  siteId: string;
  dbUrl: string;
  dbToken: string;
  /** Additional past seasons to sync (e.g. [2025]). Current year is always included. */
  extraSeasons?: number[];
}

interface SyncResult {
  matchesProcessed: number;
  errors: string[];
}

// --- Main sync logic ---

const DEADLINE_MS = 10 * 60 * 1000; // 10 minutes — stop starting new API calls after this

async function syncMatches(
  db: DbClient,
  config: SyncConfig,
  startTime: number,
): Promise<SyncResult> {
  const { apiKey, siteId } = config;
  const errors: string[] = [];
  let matchesProcessed = 0;

  // Step 1: Sync teams (non-blocking — endpoint may not be authorised)
  console.log("Syncing teams...");
  try {
    const teamsJson = await fetchApi(
      `https://play-cricket.com/api/v2/sites/${siteId}/teams.json?api_token=${apiKey}`,
      "Get teams",
    );
    const teamsData = GetTeamsResponse.parse(teamsJson);

    for (const team of teamsData.teams) {
      const teamId = team.id.toString();
      const junior = isJuniorTeam(team.team_name) ? 1 : 0;
      await db.execute({
        sql: `INSERT INTO play_cricket_team (id, name, is_junior, site_id, last_updated)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = ?, is_junior = ?, last_updated = ?`,
        args: [
          teamId,
          team.team_name,
          junior,
          siteId,
          team.last_updated,
          team.team_name,
          junior,
          team.last_updated,
        ],
      });
    }
    console.log(`Synced ${teamsData.teams.length} teams`);
  } catch (err) {
    const msg = `Teams sync skipped: ${err instanceof Error ? err.message : String(err)}`;
    console.warn(msg);
    errors.push(msg);
  }

  // Step 2: Get all matches for each season
  const currentYear = new Date().getFullYear();
  const seasons = [
    ...(config.extraSeasons ?? []),
    currentYear,
  ];
  const allMatches: Array<{
    match: z.TypeOf<typeof GetMatchSummaryResponse>["matches"][number];
    season: number;
  }> = [];

  for (const season of seasons) {
    console.log(`Fetching matches for season ${season}...`);
    const matchesJson = await fetchApi(
      `https://play-cricket.com/api/v2/matches.json?site_id=${siteId}&season=${season}&api_token=${apiKey}`,
      `Get matches ${season}`,
    );
    const matchesData = GetMatchSummaryResponse.parse(matchesJson);
    console.log(`Found ${matchesData.matches.length} matches for ${season}`);

    for (const match of matchesData.matches) {
      allMatches.push({ match, season });
    }
  }

  // Step 3: Fetch and store match detail for each match
  for (const { match, season } of allMatches) {
    const matchId = match.id.toString();

    try {
      // Skip matches we've already processed
      const existingBat = await db.execute({
        sql: `SELECT 1 FROM match_performance_batting WHERE match_id = ? LIMIT 1`,
        args: [matchId],
      });
      const existingBowl = await db.execute({
        sql: `SELECT 1 FROM match_performance_bowling WHERE match_id = ? LIMIT 1`,
        args: [matchId],
      });
      if (existingBat.rows.length > 0 || existingBowl.rows.length > 0) {
        continue;
      }

      // Stop starting new matches after the deadline
      if (Date.now() - startTime > DEADLINE_MS) {
        console.log(
          `Reached ${DEADLINE_MS / 60_000}m deadline after ${matchesProcessed} matches — stopping`,
        );
        return { matchesProcessed, errors };
      }

      const detailJson = await fetchApi(
        `https://play-cricket.com/api/v2/match_detail.json?match_id=${matchId}&api_token=${apiKey}`,
        `Get match detail ${matchId}`,
      );
      const detailData = GetMatchDetailResponse.parse(detailJson);
      const detail = detailData.match_details[0];
      if (!detail) {
        console.log(`No detail for match ${matchId}, skipping`);
        continue;
      }

      // Check if scorecard has actual data (at least one innings with batting)
      const hasScorecard = detail.innings.some(
        (inn) => inn.bat.length > 0,
      );
      if (!hasScorecard) {
        continue;
      }

      // Upsert teams discovered from match detail
      const teamEntries = [
        {
          id: detail.home_team_id,
          name: detail.home_team_name,
          clubId: detail.home_club_id,
        },
        {
          id: detail.away_team_id,
          name: detail.away_team_name,
          clubId: detail.away_club_id,
        },
      ];
      for (const t of teamEntries) {
        if (t.id && t.name && t.clubId === siteId) {
          await db.execute({
            sql: `INSERT INTO play_cricket_team (id, name, is_junior, site_id, last_updated)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = ?, is_junior = ?`,
            args: [
              t.id,
              t.name,
              isJuniorTeam(t.name) ? 1 : 0,
              siteId,
              new Date().toISOString(),
              t.name,
              isJuniorTeam(t.name) ? 1 : 0,
            ],
          });
        }
      }

      // Determine which team is ours for each innings
      const ourTeamIds = new Set<string>();
      if (match.home_club_id === siteId) {
        ourTeamIds.add(match.home_team_id);
      }
      if (match.away_club_id === siteId) {
        ourTeamIds.add(match.away_team_id);
      }

      for (const innings of detail.innings) {
        const battingTeamId = innings.team_batting_id;
        const isBattingTeamOurs = ourTeamIds.has(battingTeamId);

        const fieldingTeamId =
          battingTeamId === match.home_team_id
            ? match.away_team_id
            : match.home_team_id;
        const isFieldingTeamOurs = ourTeamIds.has(fieldingTeamId);

        // Store batting performances (only for our players)
        if (isBattingTeamOurs) {
          for (const bat of innings.bat) {
            if (!didBat(bat.how_out)) continue;

            const notOut = isNotOut(bat.how_out) ? 1 : 0;
            await db.execute({
              sql: `INSERT INTO match_performance_batting
                (id, match_id, player_id, player_name, team_id, competition_type, match_date, season, runs, balls, fours, sixes, how_out, not_out)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(match_id, player_id) DO UPDATE SET
                  player_name = ?, runs = ?, balls = ?, fours = ?, sixes = ?, how_out = ?, not_out = ?`,
              args: [
                randomId(),
                matchId,
                bat.batsman_id,
                bat.batsman_name,
                battingTeamId,
                match.competition_type ?? "",
                match.match_date,
                season,
                parseInt(bat.runs) || 0,
                parseInt(bat.balls) || 0,
                parseInt(bat.fours) || 0,
                parseInt(bat.sixes) || 0,
                bat.how_out,
                notOut,
                bat.batsman_name,
                parseInt(bat.runs) || 0,
                parseInt(bat.balls) || 0,
                parseInt(bat.fours) || 0,
                parseInt(bat.sixes) || 0,
                bat.how_out,
                notOut,
              ],
            });
          }
        }

        // Store bowling performances (only for our players)
        if (isFieldingTeamOurs) {
          for (const bowl of innings.bowl) {
            await db.execute({
              sql: `INSERT INTO match_performance_bowling
                (id, match_id, player_id, player_name, team_id, competition_type, match_date, season, overs, maidens, runs, wickets, wides, no_balls)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(match_id, player_id) DO UPDATE SET
                  player_name = ?, overs = ?, maidens = ?, runs = ?, wickets = ?, wides = ?, no_balls = ?`,
              args: [
                randomId(),
                matchId,
                bowl.bowler_id,
                bowl.bowler_name,
                fieldingTeamId,
                match.competition_type ?? "",
                match.match_date,
                season,
                bowl.overs,
                parseInt(bowl.maidens) || 0,
                parseInt(bowl.runs) || 0,
                parseInt(bowl.wickets) || 0,
                parseInt(bowl.wides) || 0,
                parseInt(bowl.no_balls) || 0,
                bowl.bowler_name,
                bowl.overs,
                parseInt(bowl.maidens) || 0,
                parseInt(bowl.runs) || 0,
                parseInt(bowl.wickets) || 0,
                parseInt(bowl.wides) || 0,
                parseInt(bowl.no_balls) || 0,
              ],
            });
          }
        }
      }

      matchesProcessed++;
      console.log(`Processed match ${matchId}`);
    } catch (err) {
      const msg = `Error processing match ${matchId}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { matchesProcessed, errors };
}

/** Run a full Play-Cricket stats sync and log the result. */
export async function runSync(config: SyncConfig): Promise<SyncResult> {
  const logId = randomId();
  const startedAt = new Date().toISOString();

  console.log(`Starting Play-Cricket stats sync (log: ${logId})`);
  console.log(
    `Using site_id=${config.siteId}, api_key=${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}`,
  );

  const db = createClient({ url: config.dbUrl, authToken: config.dbToken });
  const startTime = Date.now();

  try {
    const result = await syncMatches(db, config, startTime);

    // Log the sync
    await db.execute({
      sql: `INSERT INTO play_cricket_sync_log (id, started_at, completed_at, season, matches_processed, errors)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        logId,
        startedAt,
        new Date().toISOString(),
        new Date().getFullYear(),
        result.matchesProcessed,
        result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      ],
    });

    console.log(
      `Sync complete: ${result.matchesProcessed} matches processed, ${result.errors.length} errors`,
    );

    return result;
  } catch (err) {
    console.error("Sync failed:", err);

    // Try to log the failure
    try {
      await db.execute({
        sql: `INSERT INTO play_cricket_sync_log (id, started_at, completed_at, season, matches_processed, errors)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          logId,
          startedAt,
          new Date().toISOString(),
          new Date().getFullYear(),
          0,
          JSON.stringify([String(err)]),
        ],
      });
    } catch {
      console.error("Failed to log sync error");
    }

    throw err;
  } finally {
    db.close();
  }
}
