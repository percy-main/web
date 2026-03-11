import { createClient } from "@libsql/client/http";
import { z } from "zod";
import {
  GetMatchDetailResponse,
  GetMatchSummaryResponse,
  GetTeamsResponse,
  MatchDetailBat,
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

const NOT_OUT_CODES = new Set(["no", "dnb", "rtd", "ro", "ret out", ""]);

function isNotOut(howOut: string | null | undefined): boolean {
  if (!howOut) return true;
  return NOT_OUT_CODES.has(howOut.toLowerCase().trim());
}

function didBat(howOut: string | null | undefined): boolean {
  if (!howOut) return false;
  const code = howOut.toLowerCase().trim();
  return code !== "dnb" && code !== "";
}

/** Determine what type of fielding credit a dismissal gives, if any. */
function parseDismissalType(
  howOut: string | null | undefined,
): "catch" | "stumping" | "run_out" | null {
  if (!howOut) return null;
  const code = howOut.toLowerCase().trim();
  if (code === "ct" || code.startsWith("caught")) return "catch";
  if (code === "st" || code.startsWith("stumped")) return "stumping";
  if (code.includes("run out")) return "run_out";
  return null;
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

interface FieldingAgg {
  playerName: string;
  catches: number;
  runOuts: number;
  stumpings: number;
  isWicketkeeper: boolean;
}

// --- Main sync logic ---

const DEADLINE_MS = 10 * 60 * 1000; // 10 minutes — stop starting new API calls after this

/**
 * Build a set of wicketkeeper player IDs from the match detail players array.
 */
function getWicketkeeperIds(
  players: z.output<typeof GetMatchDetailResponse>["match_details"][number]["players"],
  teamSide: "home" | "away",
): Set<string> {
  const keeperIds = new Set<string>();
  for (const group of players) {
    const squad =
      teamSide === "home" ? group.home_team : group.away_team;
    if (!squad) continue;
    for (const player of squad) {
      if (player.wicket_keeper && player.player_id != null) {
        keeperIds.add(player.player_id.toString());
      }
    }
  }
  return keeperIds;
}

/**
 * Extract fielding credits from a batting innings.
 * The batting team's data tells us which fielders took catches/run outs/stumpings.
 */
function extractFieldingCredits(
  batEntries: Array<z.output<typeof MatchDetailBat>>,
  keeperIds: Set<string>,
): Map<string, FieldingAgg> {
  const fielders = new Map<string, FieldingAgg>();

  for (const bat of batEntries) {
    const dismissalType = parseDismissalType(bat.how_out);
    if (!dismissalType) continue;

    const fielderId = bat.fielder_id;
    const fielderName = bat.fielder_name;
    if (!fielderId || !fielderName) continue;

    let agg = fielders.get(fielderId);
    if (!agg) {
      agg = {
        playerName: fielderName,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        isWicketkeeper: keeperIds.has(fielderId),
      };
      fielders.set(fielderId, agg);
    }

    switch (dismissalType) {
      case "catch":
        agg.catches++;
        break;
      case "run_out":
        agg.runOuts++;
        break;
      case "stumping":
        agg.stumpings++;
        break;
    }
  }

  return fielders;
}

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
    match: z.output<typeof GetMatchSummaryResponse>["matches"][number];
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

  // Step 3: Load already-processed match IDs
  // Use match_result table as the source of truth — a match is fully processed
  // only when its result has been stored. This ensures that matches synced before
  // fielding/result extraction was added will be re-processed to backfill.
  const processedResult = await db.execute({
    sql: `SELECT DISTINCT match_id FROM match_result`,
    args: [],
  });
  const processedMatchIds = new Set<string>();
  for (const row of processedResult.rows) {
    processedMatchIds.add(row.match_id as string);
  }
  console.log(`Found ${processedMatchIds.size} already-processed matches — skipping those`);

  // Step 4: Fetch and store match detail for each match
  for (const { match, season } of allMatches) {
    const matchId = match.id.toString();

    try {
      if (processedMatchIds.has(matchId)) {
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

      // Build keeper lookup from players list
      const homeKeeperIds = getWicketkeeperIds(detail.players, "home");
      const awayKeeperIds = getWicketkeeperIds(detail.players, "away");

      for (const innings of detail.innings) {
        const battingTeamId = innings.team_batting_id;
        const isBattingTeamOurs = ourTeamIds.has(battingTeamId);

        const fieldingTeamId =
          battingTeamId === match.home_team_id
            ? match.away_team_id
            : match.home_team_id;
        const isFieldingTeamOurs = ourTeamIds.has(fieldingTeamId);

        // The fielding team's keepers: if the fielding team is the home team,
        // use home keepers; otherwise use away keepers
        const fieldingKeeperIds =
          fieldingTeamId === match.home_team_id
            ? homeKeeperIds
            : awayKeeperIds;

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
                bat.how_out ?? "",
                notOut,
                bat.batsman_name,
                parseInt(bat.runs) || 0,
                parseInt(bat.balls) || 0,
                parseInt(bat.fours) || 0,
                parseInt(bat.sixes) || 0,
                bat.how_out ?? "",
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

        // Store fielding performances (only for our players)
        // Fielding credits come from the opponent's batting dismissals
        if (isFieldingTeamOurs) {
          const fieldingCredits = extractFieldingCredits(
            innings.bat,
            fieldingKeeperIds,
          );

          for (const [fielderId, agg] of fieldingCredits) {
            await db.execute({
              sql: `INSERT INTO match_performance_fielding
                (id, match_id, player_id, player_name, team_id, competition_type, match_date, season, catches, run_outs, stumpings, is_wicketkeeper)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(match_id, player_id) DO UPDATE SET
                  player_name = ?,
                  catches = match_performance_fielding.catches + excluded.catches,
                  run_outs = match_performance_fielding.run_outs + excluded.run_outs,
                  stumpings = match_performance_fielding.stumpings + excluded.stumpings,
                  is_wicketkeeper = MAX(match_performance_fielding.is_wicketkeeper, excluded.is_wicketkeeper)`,
              args: [
                randomId(),
                matchId,
                fielderId,
                agg.playerName,
                fieldingTeamId,
                match.competition_type ?? "",
                match.match_date,
                season,
                agg.catches,
                agg.runOuts,
                agg.stumpings,
                agg.isWicketkeeper ? 1 : 0,
                agg.playerName,
              ],
            });
          }
        }
      }

      // Store match result — only when a result has been entered in Play Cricket.
      // Matches without a result yet will be re-processed on the next sync since
      // they won't appear in the processedMatchIds set (which queries match_result).
      const matchResult = (detail.result ?? "").trim();
      if (matchResult) {
        await db.execute({
          sql: `INSERT INTO match_result
            (id, match_id, home_team_id, away_team_id, home_team_name, away_team_name, result, result_description, result_applied_to, competition_type, match_date, season)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(match_id) DO UPDATE SET
              result = ?, result_description = ?, result_applied_to = ?`,
          args: [
            randomId(),
            matchId,
            detail.home_team_id,
            detail.away_team_id,
            detail.home_team_name,
            detail.away_team_name,
            matchResult,
            detail.result_description ?? "",
            detail.result_applied_to ?? "",
            match.competition_type ?? "",
            match.match_date,
            season,
            matchResult,
            detail.result_description ?? "",
            detail.result_applied_to ?? "",
          ],
        });
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
