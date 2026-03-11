import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import {
  getCurrentGameweek,
  getCurrentSeason,
  getTransferWindowInfo,
  isGameweekLocked,
  MAX_TRANSFERS_PER_GAMEWEEK,
} from "@/lib/fantasy/gameweek";
import {
  ELIGIBLE_TEAM_IDS,
  LEAGUE_COMPETITION_TYPES,
} from "@/lib/fantasy/scoring";
import { ActionError } from "astro:actions";
import { z } from "astro/zod";
import { sql } from "kysely";

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

const listPlayers = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    search: z.string().optional(),
  }),
  handler: async ({ search }) => {
    let query = client
      .selectFrom("fantasy_player")
      .selectAll()
      .orderBy("player_name", "asc");

    if (search) {
      query = query.where("player_name", "like", `%${search}%`);
    }

    const players = await query.execute();
    return { players };
  },
});

const toggleEligibility = defineAuthAction({
  roles: ["admin"],
  input: z.object({
    playCricketId: z.string(),
    eligible: z.boolean(),
  }),
  handler: async ({ playCricketId, eligible }) => {
    await client
      .updateTable("fantasy_player")
      .set({ eligible: eligible ? 1 : 0 })
      .where("play_cricket_id", "=", playCricketId)
      .execute();

    return { success: true };
  },
});

const populatePlayers = defineAuthAction({
  roles: ["admin"],
  handler: async () => {
    // Get distinct players from batting, bowling, and fielding performance tables
    const battingPlayers = await client
      .selectFrom("match_performance_batting")
      .select(["player_id", "player_name"])
      .distinct()
      .execute();

    const bowlingPlayers = await client
      .selectFrom("match_performance_bowling")
      .select(["player_id", "player_name"])
      .distinct()
      .execute();

    const fieldingPlayers = await client
      .selectFrom("match_performance_fielding")
      .select(["player_id", "player_name"])
      .distinct()
      .execute();

    // Merge all players, preferring the most recent name
    const playerMap = new Map<string, string>();
    for (const p of [...battingPlayers, ...bowlingPlayers, ...fieldingPlayers]) {
      playerMap.set(p.player_id, p.player_name);
    }

    let inserted = 0;
    for (const [playerId, playerName] of playerMap) {
      const result = await client
        .insertInto("fantasy_player")
        .values({
          play_cricket_id: playerId,
          player_name: playerName,
        })
        .onConflict((oc) =>
          oc.column("play_cricket_id").doUpdateSet({ player_name: playerName }),
        )
        .execute();

      if (result[0]?.numInsertedOrUpdatedRows) {
        inserted++;
      }
    }

    return { total: playerMap.size, inserted };
  },
});

// ---------------------------------------------------------------------------
// Member actions
// ---------------------------------------------------------------------------

const getEligiblePlayers = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();
    const previousSeason = (Number(currentSeason) - 1).toString();

    const players = await client
      .selectFrom("fantasy_player")
      .where("eligible", "=", 1)
      .selectAll()
      .orderBy("player_name", "asc")
      .execute();

    // Get stats for current and previous seasons
    const eligibleTeamIds = Array.from(ELIGIBLE_TEAM_IDS);
    const leagueTypes = Array.from(LEAGUE_COMPETITION_TYPES);

    const battingStats = await client
      .selectFrom("match_performance_batting")
      .where("season", "in", [Number(currentSeason), Number(previousSeason)])
      .where("team_id", "in", eligibleTeamIds)
      .where("competition_type", "in", leagueTypes)
      .select([
        "player_id",
        "season",
        sql<number>`COUNT(*)`.as("matches"),
        sql<number>`SUM(runs)`.as("total_runs"),
        sql<number>`MAX(runs)`.as("high_score"),
        sql<number>`ROUND(AVG(runs), 1)`.as("avg_runs"),
      ])
      .groupBy(["player_id", "season"])
      .execute();

    const bowlingStats = await client
      .selectFrom("match_performance_bowling")
      .where("season", "in", [Number(currentSeason), Number(previousSeason)])
      .where("team_id", "in", eligibleTeamIds)
      .where("competition_type", "in", leagueTypes)
      .select([
        "player_id",
        "season",
        sql<number>`SUM(wickets)`.as("total_wickets"),
        sql<number>`ROUND(AVG(CAST(wickets AS REAL)), 1)`.as("avg_wickets"),
      ])
      .groupBy(["player_id", "season"])
      .execute();

    const fieldingStats = await client
      .selectFrom("match_performance_fielding")
      .where("season", "in", [Number(currentSeason), Number(previousSeason)])
      .where("team_id", "in", eligibleTeamIds)
      .where("competition_type", "in", leagueTypes)
      .select([
        "player_id",
        "season",
        sql<number>`SUM(catches)`.as("total_catches"),
        sql<number>`SUM(run_outs)`.as("total_run_outs"),
        sql<number>`SUM(stumpings)`.as("total_stumpings"),
      ])
      .groupBy(["player_id", "season"])
      .execute();

    // Build stats map
    type PlayerStats = {
      matches?: number;
      totalRuns?: number;
      highScore?: number;
      avgRuns?: number;
      totalWickets?: number;
      avgWickets?: number;
      totalCatches?: number;
      totalRunOuts?: number;
      totalStumpings?: number;
    };

    const statsMap = new Map<string, { current: PlayerStats; previous: PlayerStats }>();

    const getOrCreate = (playerId: string) => {
      if (!statsMap.has(playerId)) {
        statsMap.set(playerId, { current: {}, previous: {} });
      }
      return statsMap.get(playerId)!;
    };

    for (const row of battingStats) {
      const entry = getOrCreate(row.player_id);
      const target = row.season === Number(currentSeason) ? entry.current : entry.previous;
      target.matches = row.matches;
      target.totalRuns = row.total_runs;
      target.highScore = row.high_score;
      target.avgRuns = row.avg_runs;
    }

    for (const row of bowlingStats) {
      const entry = getOrCreate(row.player_id);
      const target = row.season === Number(currentSeason) ? entry.current : entry.previous;
      target.totalWickets = row.total_wickets;
      target.avgWickets = row.avg_wickets;
    }

    for (const row of fieldingStats) {
      const entry = getOrCreate(row.player_id);
      const target = row.season === Number(currentSeason) ? entry.current : entry.previous;
      target.totalCatches = row.total_catches;
      target.totalRunOuts = row.total_run_outs;
      target.totalStumpings = row.total_stumpings;
    }

    return {
      players: players.map((p) => ({
        playCricketId: p.play_cricket_id,
        playerName: p.player_name,
        stats: statsMap.get(p.play_cricket_id) ?? { current: {}, previous: {} },
      })),
      season: currentSeason,
    };
  },
});

const getMyTeam = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }, session) => {
    const currentSeason = season ?? getCurrentSeason();
    const gameweek = getCurrentGameweek(currentSeason);

    const team = await client
      .selectFrom("fantasy_team")
      .where("user_id", "=", session.user.id)
      .where("season", "=", currentSeason)
      .selectAll()
      .executeTakeFirst();

    if (!team) {
      return {
        team: null,
        players: [],
        transferWindowInfo: getTransferWindowInfo(currentSeason),
        gameweek,
      };
    }

    // Get active players (gameweek_added <= current AND (gameweek_removed IS NULL OR gameweek_removed > current))
    const players = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .where("ftp.fantasy_team_id", "=", team.id!)
      .where("ftp.gameweek_added", "<=", gameweek)
      .where((eb) =>
        eb.or([
          eb("ftp.gameweek_removed", "is", null),
          eb("ftp.gameweek_removed", ">", gameweek),
        ]),
      )
      .select([
        "ftp.id",
        "ftp.play_cricket_id",
        "fp.player_name",
        "ftp.is_captain",
        "ftp.gameweek_added",
      ])
      .execute();

    // Count transfers made this gameweek
    const transfersThisWeek = await client
      .selectFrom("fantasy_team_player")
      .where("fantasy_team_id", "=", team.id!)
      .where("gameweek_added", "=", gameweek)
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirst();

    // Subtract initial squad size for gameweek 1 (not transfers)
    // For subsequent gameweeks, only count players added THIS gameweek as transfers
    const initialPlayers = await client
      .selectFrom("fantasy_team_player")
      .where("fantasy_team_id", "=", team.id!)
      .where("gameweek_added", "<", gameweek)
      .where((eb) =>
        eb.or([
          eb("gameweek_removed", "is", null),
          eb("gameweek_removed", ">", gameweek - 1),
        ]),
      )
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirst();

    const isInitialSquad = (initialPlayers?.count ?? 0) === 0;
    const transfersUsed = isInitialSquad ? 0 : (transfersThisWeek?.count ?? 0);

    return {
      team: { id: team.id, season: team.season, createdAt: team.created_at },
      players: players.map((p) => ({
        id: p.id,
        playCricketId: p.play_cricket_id,
        playerName: p.player_name,
        isCaptain: p.is_captain === 1,
        gameweekAdded: p.gameweek_added,
      })),
      transferWindowInfo: getTransferWindowInfo(currentSeason),
      gameweek,
      transfersUsed,
      maxTransfers: MAX_TRANSFERS_PER_GAMEWEEK,
    };
  },
});

const saveTeam = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
    players: z
      .array(
        z.object({
          playCricketId: z.string(),
          isCaptain: z.boolean(),
        }),
      )
      .length(11),
  }),
  handler: async ({ season, players }, session) => {
    const currentSeason = season ?? getCurrentSeason();

    // Enforce lock
    if (isGameweekLocked()) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "Team editing is locked during match weekends (Saturday–Sunday). Editing reopens Monday.",
      });
    }

    // Validate exactly one captain
    const captains = players.filter((p) => p.isCaptain);
    if (captains.length !== 1) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Exactly one player must be designated as captain.",
      });
    }

    // Validate no duplicate players
    const playerIds = new Set(players.map((p) => p.playCricketId));
    if (playerIds.size !== 11) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "All 11 players must be different.",
      });
    }

    // Validate all players are eligible
    const eligiblePlayers = await client
      .selectFrom("fantasy_player")
      .where("play_cricket_id", "in", Array.from(playerIds))
      .where("eligible", "=", 1)
      .select("play_cricket_id")
      .execute();

    if (eligiblePlayers.length !== 11) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "All selected players must be eligible for fantasy cricket.",
      });
    }

    const gameweek = getCurrentGameweek(currentSeason);

    // Use a transaction to prevent race conditions on transfer limits
    return await client.transaction().execute(async (trx) => {
      // Get or create team
      let teamId: number;
      const existingTeam = await trx
        .selectFrom("fantasy_team")
        .where("user_id", "=", session.user.id)
        .where("season", "=", currentSeason)
        .select("id")
        .executeTakeFirst();

      if (!existingTeam) {
        // Create new team — this is the initial squad, no transfer limits
        const result = await trx
          .insertInto("fantasy_team")
          .values({
            user_id: session.user.id,
            season: currentSeason,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        teamId = result.id as number;

        // Insert all 11 players
        for (const player of players) {
          await trx
            .insertInto("fantasy_team_player")
            .values({
              fantasy_team_id: teamId,
              play_cricket_id: player.playCricketId,
              is_captain: player.isCaptain ? 1 : 0,
              gameweek_added: gameweek,
            })
            .execute();
        }

        return { success: true, teamId };
      }

      teamId = existingTeam.id as number;

      // Existing team — handle transfers
      const currentPlayers = await trx
        .selectFrom("fantasy_team_player")
        .where("fantasy_team_id", "=", teamId)
        .where("gameweek_added", "<=", gameweek)
        .where((eb) =>
          eb.or([
            eb("gameweek_removed", "is", null),
            eb("gameweek_removed", ">", gameweek),
          ]),
        )
        .selectAll()
        .execute();

      const currentPlayerIds = new Set(
        currentPlayers.map((p) => p.play_cricket_id),
      );
      const newPlayerIds = new Set(players.map((p) => p.playCricketId));

      // Find players being added and removed
      const playersToAdd = players.filter(
        (p) => !currentPlayerIds.has(p.playCricketId),
      );
      const playersToRemove = currentPlayers.filter(
        (p) => !newPlayerIds.has(p.play_cricket_id),
      );

      // Check transfer limit — only applies when modifying an existing squad
      if (currentPlayers.length > 0 && playersToAdd.length > 0) {
        const hasSquadFromBefore = currentPlayers.some(
          (p) => p.gameweek_added < gameweek,
        );

        if (hasSquadFromBefore) {
          // Count transfers already committed this gameweek (excluding the
          // initial squad which was all added in an earlier gameweek).
          // Players that were added this gameweek and are now being un-done
          // (removed in this same request) effectively free up a transfer slot.
          const addedThisWeekBeingRemoved = playersToRemove.filter(
            (p) => p.gameweek_added === gameweek,
          ).length;

          // Count transfers already persisted this gameweek
          const persistedTransfers = await trx
            .selectFrom("fantasy_team_player")
            .where("fantasy_team_id", "=", teamId)
            .where("gameweek_added", "=", gameweek)
            .select(sql<number>`COUNT(*)`.as("count"))
            .executeTakeFirst();

          const previousTransfers = persistedTransfers?.count ?? 0;
          const netTransfers =
            previousTransfers + playersToAdd.length - addedThisWeekBeingRemoved;

          if (netTransfers > MAX_TRANSFERS_PER_GAMEWEEK) {
            throw new ActionError({
              code: "BAD_REQUEST",
              message: `You can only make ${MAX_TRANSFERS_PER_GAMEWEEK} transfers per gameweek. You have used ${previousTransfers} already.`,
            });
          }
        }
      }

      // Apply removals — mark gameweek_removed
      for (const player of playersToRemove) {
        await trx
          .updateTable("fantasy_team_player")
          .set({ gameweek_removed: gameweek })
          .where("id", "=", player.id!)
          .execute();
      }

      // Apply additions
      for (const player of playersToAdd) {
        await trx
          .insertInto("fantasy_team_player")
          .values({
            fantasy_team_id: teamId,
            play_cricket_id: player.playCricketId,
            is_captain: player.isCaptain ? 1 : 0,
            gameweek_added: gameweek,
          })
          .execute();
      }

      // Update captain designation for existing players
      for (const player of players) {
        if (currentPlayerIds.has(player.playCricketId)) {
          const existing = currentPlayers.find(
            (p) => p.play_cricket_id === player.playCricketId,
          );
          if (existing && (existing.is_captain === 1) !== player.isCaptain) {
            await trx
              .updateTable("fantasy_team_player")
              .set({ is_captain: player.isCaptain ? 1 : 0 })
              .where("id", "=", existing.id!)
              .execute();
          }
        }
      }

      return { success: true, teamId };
    });
  },
});

const getTeam = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    teamId: z.number(),
  }),
  handler: async ({ teamId }) => {
    const team = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.id", "=", teamId)
      .select([
        "ft.id",
        "ft.season",
        "ft.created_at",
        "u.name as ownerName",
        "u.id as ownerId",
      ])
      .executeTakeFirst();

    if (!team) {
      throw new ActionError({ code: "NOT_FOUND", message: "Team not found." });
    }

    const gameweek = getCurrentGameweek(team.season);

    const players = await client
      .selectFrom("fantasy_team_player as ftp")
      .innerJoin(
        "fantasy_player as fp",
        "fp.play_cricket_id",
        "ftp.play_cricket_id",
      )
      .where("ftp.fantasy_team_id", "=", team.id!)
      .where("ftp.gameweek_added", "<=", gameweek)
      .where((eb) =>
        eb.or([
          eb("ftp.gameweek_removed", "is", null),
          eb("ftp.gameweek_removed", ">", gameweek),
        ]),
      )
      .select([
        "ftp.play_cricket_id",
        "fp.player_name",
        "ftp.is_captain",
      ])
      .execute();

    return {
      team: {
        id: team.id,
        season: team.season,
        ownerName: team.ownerName,
        ownerId: team.ownerId,
      },
      players: players.map((p) => ({
        playCricketId: p.play_cricket_id,
        playerName: p.player_name,
        isCaptain: p.is_captain === 1,
      })),
    };
  },
});

const listTeams = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();

    const teams = await client
      .selectFrom("fantasy_team as ft")
      .innerJoin("user as u", "u.id", "ft.user_id")
      .where("ft.season", "=", currentSeason)
      .select([
        "ft.id",
        "ft.season",
        "ft.created_at",
        "u.name as ownerName",
        "u.id as ownerId",
      ])
      .orderBy("ft.created_at", "asc")
      .execute();

    return {
      teams: teams.map((t) => ({
        id: t.id,
        season: t.season,
        ownerName: t.ownerName,
        ownerId: t.ownerId,
        createdAt: t.created_at,
      })),
      season: currentSeason,
    };
  },
});

const getTransferWindow = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    season: z.string().optional(),
  }),
  handler: async ({ season }) => {
    const currentSeason = season ?? getCurrentSeason();
    return getTransferWindowInfo(currentSeason);
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const fantasy = {
  listPlayers,
  toggleEligibility,
  populatePlayers,
  getEligiblePlayers,
  getMyTeam,
  saveTeam,
  getTeam,
  listTeams,
  getTransferWindow,
};
