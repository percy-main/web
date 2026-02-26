import { createClient } from "@libsql/client/http";
import { schedule } from "@netlify/functions";
import { z } from "zod";

// --- Zod schemas (duplicated from src/lib/play-cricket/schemas.ts to avoid
//     import path issues in the Netlify function bundler) ---

const GetMatchSummaryResponse = z.object({
  matches: z.array(
    z.object({
      id: z.number(),
      status: z.string(),
      last_updated: z.string(),
      competition_type: z.string(),
      match_type: z.string(),
      match_date: z.string(),
      home_team_id: z.string(),
      home_club_id: z.string(),
      away_team_id: z.string(),
      away_club_id: z.string(),
      season: z.string(),
    }),
  ),
});

const MatchDetailBat = z.object({
  batsman_name: z.string(),
  batsman_id: z.string(),
  how_out: z.string(),
  fielder_name: z.string().optional().default(""),
  fielder_id: z.string().optional().default(""),
  runs: z.string(),
  fours: z.string(),
  sixes: z.string(),
  balls: z.string(),
});

const MatchDetailBowl = z.object({
  bowler_name: z.string(),
  bowler_id: z.string(),
  overs: z.string(),
  maidens: z.string(),
  runs: z.string(),
  wides: z.string(),
  wickets: z.string(),
  no_balls: z.string(),
});

const MatchDetailInnings = z.object({
  team_batting_name: z.string(),
  team_batting_id: z.string(),
  innings_number: z.number(),
  bat: z.array(MatchDetailBat),
  bowl: z.array(MatchDetailBowl),
});

const MatchDetail = z.object({
  id: z.number(),
  home_team_name: z.string().optional().default(""),
  home_team_id: z.string(),
  home_club_id: z.string().optional().default(""),
  away_team_name: z.string().optional().default(""),
  away_team_id: z.string(),
  away_club_id: z.string().optional().default(""),
  result: z.string().optional().default(""),
  competition_type: z.string().optional().default(""),
  match_date: z.string().optional().default(""),
  season: z.string().optional().default(""),
  innings: z.array(MatchDetailInnings),
});

const GetMatchDetailResponse = z.object({
  match_details: z.array(MatchDetail),
});

const GetTeamsResponse = z.object({
  teams: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      status: z.string(),
      last_updated: z.string(),
      site_id: z.union([z.string(), z.number()]),
      team_name: z.string(),
    }),
  ),
});

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

// Not-out dismissal codes — player was not dismissed
const NOT_OUT_CODES = new Set(["no", "dnb", "rtd", ""]);

function isNotOut(howOut: string): boolean {
  return NOT_OUT_CODES.has(howOut.toLowerCase().trim());
}

// Did the player actually bat (i.e. not "did not bat")?
function didBat(howOut: string): boolean {
  const code = howOut.toLowerCase().trim();
  return code !== "dnb" && code !== "";
}

type DbClient = ReturnType<typeof createClient>;

function createDb() {
  const url = process.env.DB_SYNC_URL;
  const authToken = process.env.DB_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing DB_SYNC_URL or DB_TOKEN");
  }
  return createClient({ url, authToken });
}

// --- Main sync logic ---

async function syncStats(): Promise<{
  matchesProcessed: number;
  errors: string[];
}> {
  const apiKey = process.env.PLAY_CRICKET_API_KEY;
  const siteId = process.env.PLAY_CRICKET_SITE_ID;

  if (!apiKey || !siteId) {
    throw new Error(
      "Missing required env vars: PLAY_CRICKET_API_KEY, PLAY_CRICKET_SITE_ID",
    );
  }

  console.log(
    `Using site_id=${siteId}, api_key=${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
  );

  const db = createDb();
  const errors: string[] = [];
  let matchesProcessed = 0;

  try {
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
    // TODO: remove 2025 after first successful sync — that season is complete
    const seasons = [2025, new Date().getFullYear()];
    const allCompletedMatches: Array<{ match: z.TypeOf<typeof GetMatchSummaryResponse>["matches"][number]; season: number }> = [];

    for (const season of seasons) {
      console.log(`Fetching matches for season ${season}...`);
      const matchesJson = await fetchApi(
        `https://play-cricket.com/api/v2/matches.json?site_id=${siteId}&season=${season}&api_token=${apiKey}`,
        `Get matches ${season}`,
      );
      const matchesData = GetMatchSummaryResponse.parse(matchesJson);
      console.log(`Found ${matchesData.matches.length} matches for ${season}`);

      const completed = matchesData.matches.filter(
        (m) => m.status !== "New",
      );
      console.log(`${completed.length} completed matches for ${season}`);
      for (const match of completed) {
        allCompletedMatches.push({ match, season });
      }
    }

    // Step 3: Fetch and store match detail for each completed match
    for (const { match, season } of allCompletedMatches) {
      const matchId = match.id.toString();

      try {
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
          console.log(
            `Match ${matchId} has no scorecard data, skipping`,
          );
          continue;
        }

        // Upsert teams discovered from match detail (fallback when teams endpoint is unavailable)
        const teamEntries = [
          { id: detail.home_team_id, name: detail.home_team_name, clubId: detail.home_club_id },
          { id: detail.away_team_id, name: detail.away_team_name, clubId: detail.away_club_id },
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

          // Determine the fielding team (the team that bowled this innings)
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
                  match.competition_type,
                  match.match_date,
                  season,
                  parseInt(bat.runs) || 0,
                  parseInt(bat.balls) || 0,
                  parseInt(bat.fours) || 0,
                  parseInt(bat.sixes) || 0,
                  bat.how_out,
                  notOut,
                  // ON CONFLICT SET values
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

          // Store bowling performances (only for our players — the fielding team bowled)
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
                  match.competition_type,
                  match.match_date,
                  season,
                  bowl.overs,
                  parseInt(bowl.maidens) || 0,
                  parseInt(bowl.runs) || 0,
                  parseInt(bowl.wickets) || 0,
                  parseInt(bowl.wides) || 0,
                  parseInt(bowl.no_balls) || 0,
                  // ON CONFLICT SET values
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
  } finally {
    db.close();
  }

  return { matchesProcessed, errors };
}

// Run at 3 AM UTC on Sundays and Fridays (overnight Sat→Sun and Thu→Fri)
export const handler = schedule("0 3 * * 0,5", async () => {
  const logId = randomId();
  const startedAt = new Date().toISOString();

  console.log(`Starting Play-Cricket stats sync (log: ${logId})`);

  let db: DbClient | null = null;
  try {
    const { matchesProcessed, errors } = await syncStats();

    // Log the sync
    db = createDb();
    await db.execute({
      sql: `INSERT INTO play_cricket_sync_log (id, started_at, completed_at, season, matches_processed, errors)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        logId,
        startedAt,
        new Date().toISOString(),
        new Date().getFullYear(),
        matchesProcessed,
        errors.length > 0 ? JSON.stringify(errors) : null,
      ],
    });

    console.log(
      `Sync complete: ${matchesProcessed} matches processed, ${errors.length} errors`,
    );
  } catch (err) {
    console.error("Sync failed:", err);

    // Try to log the failure
    try {
      if (!db) {
        db = createDb();
      }
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
  } finally {
    db?.close();
  }

  return { statusCode: 200 };
});
