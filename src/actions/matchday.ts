import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import * as playCricketApi from "@/lib/play-cricket";
import { PLAY_CRICKET_SITE_ID } from "astro:env/server";
import { ActionError } from "astro:actions";
import { z } from "astro:schema";
import { parse, isBefore, startOfDay, subDays } from "date-fns";
import { randomUUID } from "crypto";

/**
 * Returns the user's role from the DB.
 */
async function getUserRole(userId: string): Promise<string | null> {
  const row = await client
    .selectFrom("user")
    .where("id", "=", userId)
    .select("role")
    .executeTakeFirst();
  return row?.role ?? null;
}

/**
 * Returns the play_cricket_team IDs the user is allowed to access.
 * Admins get all teams; officials get their assigned teams.
 */
async function getAccessibleTeamIds(userId: string): Promise<string[]> {
  const role = await getUserRole(userId);

  if (role === "admin") {
    const allTeams = await client
      .selectFrom("play_cricket_team")
      .select("id")
      .execute();
    return allTeams.map((t) => t.id).filter((id): id is string => id !== null);
  }

  const assignments = await client
    .selectFrom("team_official")
    .where("user_id", "=", userId)
    .select("play_cricket_team_id")
    .execute();

  return assignments.map((a) => a.play_cricket_team_id);
}

export const matchday = {
  /** List teams accessible to the current official/admin. */
  listMyTeams: defineAuthAction({
    roles: ["official", "admin"],
    handler: async (_, { user }) => {
      const accessibleIds = await getAccessibleTeamIds(user.id);

      if (accessibleIds.length === 0) {
        return [];
      }

      const teams = await client
        .selectFrom("play_cricket_team")
        .where("id", "in", accessibleIds)
        .select(["id", "name", "is_junior"])
        .orderBy("name", "asc")
        .execute();

      return teams.filter(
        (t): t is typeof t & { id: string } => t.id !== null,
      );
    },
  }),

  /** Get upcoming matches for a specific team from Play-Cricket API. */
  getUpcomingMatches: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      teamId: z.string(),
    }),
    handler: async ({ teamId }, { user }) => {
      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(teamId)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this team.",
        });
      }

      const now = new Date();
      const season = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
      const summary = await playCricketApi.getMatchesSummary({ season });

      // Filter to matches involving this team, from today onwards (include today)
      const cutoff = startOfDay(subDays(now, 1));

      const upcoming = summary.matches
        .filter((m) => {
          const isOurTeam =
            (m.home_club_id === PLAY_CRICKET_SITE_ID &&
              m.home_team_id === teamId) ||
            (m.away_club_id === PLAY_CRICKET_SITE_ID &&
              m.away_team_id === teamId);
          if (!isOurTeam) return false;

          const matchDate = parse(m.match_date, "dd/MM/yyyy", new Date());
          return !isBefore(matchDate, cutoff);
        })
        .map((m) => {
          const isHome = m.home_club_id === PLAY_CRICKET_SITE_ID;
          return {
            matchId: m.id.toString(),
            matchDate: m.match_date,
            matchTime: m.match_time ?? null,
            opposition: isHome
              ? `${m.away_club_name} ${m.away_team_name}`
              : `${m.home_club_name} ${m.home_team_name}`,
            isHome,
            competitionName: m.competition_name ?? null,
            competitionType: m.competition_type ?? null,
          };
        })
        .sort((a, b) => {
          const dateA = parse(a.matchDate, "dd/MM/yyyy", new Date());
          const dateB = parse(b.matchDate, "dd/MM/yyyy", new Date());
          return dateA.getTime() - dateB.getTime();
        });

      // Check which matches already have a matchday record
      const matchIds = upcoming.map((m) => m.matchId);
      const existingMatchdays =
        matchIds.length > 0
          ? await client
              .selectFrom("matchday")
              .where("play_cricket_team_id", "=", teamId)
              .selectAll()
              .execute()
          : [];

      const matchdayByDate = new Map(
        existingMatchdays.map((md) => [md.match_date, md]),
      );

      return upcoming.map((m) => {
        // Match on date since we store ISO date, not Play-Cricket match ID
        const isoDate = parse(m.matchDate, "dd/MM/yyyy", new Date())
          .toISOString()
          .split("T")[0];
        const existingMatchday = matchdayByDate.get(isoDate);

        return {
          ...m,
          matchdayId: existingMatchday?.id ?? null,
          matchdayStatus: existingMatchday?.status ?? null,
        };
      });
    },
  }),

  /** Create a matchday record for a specific match. */
  createMatchday: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      teamId: z.string(),
      matchDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
      opposition: z.string().min(1),
    }),
    handler: async ({ teamId, matchDate, opposition }, { user }) => {
      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(teamId)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this team.",
        });
      }

      // Check no existing matchday for this team + date
      const existing = await client
        .selectFrom("matchday")
        .where("play_cricket_team_id", "=", teamId)
        .where("match_date", "=", matchDate)
        .select("id")
        .executeTakeFirst();

      if (existing) {
        throw new ActionError({
          code: "CONFLICT",
          message: "A matchday already exists for this team and date.",
        });
      }

      const id = randomUUID();
      await client
        .insertInto("matchday")
        .values({
          id,
          play_cricket_team_id: teamId,
          match_date: matchDate,
          opposition,
          status: "pending",
          created_by: user.id,
        })
        .execute();

      return { id };
    },
  }),

  /** Get a matchday with its players. */
  getMatchday: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayId: z.string(),
    }),
    handler: async ({ matchdayId }, { user }) => {
      const matchday = await client
        .selectFrom("matchday")
        .where("id", "=", matchdayId)
        .selectAll()
        .executeTakeFirst();

      if (!matchday) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Matchday not found.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(matchday.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      const players = await client
        .selectFrom("matchday_player")
        .where("matchday_id", "=", matchdayId)
        .leftJoin("member", "member.id", "matchday_player.member_id")
        .select([
          "matchday_player.id",
          "matchday_player.member_id",
          "matchday_player.player_name",
          "matchday_player.status",
          "matchday_player.replaced_by_matchday_player_id",
          "matchday_player.charge_id",
          "matchday_player.created_at",
          "member.member_category",
        ])
        .orderBy("matchday_player.created_at", "asc")
        .execute();

      const team = await client
        .selectFrom("play_cricket_team")
        .where("id", "=", matchday.play_cricket_team_id)
        .select(["id", "name"])
        .executeTakeFirst();

      return {
        matchday,
        team: team ?? null,
        players,
      };
    },
  }),

  /** Search members for adding to a matchday squad. */
  searchMembers: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      query: z.string().min(1),
    }),
    handler: async ({ query }) => {
      const term = `%${query.trim()}%`;

      const members = await client
        .selectFrom("member")
        .where("name", "like", term)
        .select(["id", "name", "email", "member_category"])
        .orderBy("name", "asc")
        .limit(20)
        .execute();

      return members;
    },
  }),

  /** Add a player to a matchday squad. */
  addPlayer: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayId: z.string(),
      memberId: z.string().optional(),
      playerName: z.string().min(1),
    }),
    handler: async ({ matchdayId, memberId, playerName }, { user }) => {
      const matchday = await client
        .selectFrom("matchday")
        .where("id", "=", matchdayId)
        .select(["id", "play_cricket_team_id", "status"])
        .executeTakeFirst();

      if (!matchday) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Matchday not found.",
        });
      }

      if (matchday.status === "finished") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Cannot add players to a finished matchday.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(matchday.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      // If memberId provided, check they're not already in the squad
      if (memberId) {
        const existing = await client
          .selectFrom("matchday_player")
          .where("matchday_id", "=", matchdayId)
          .where("member_id", "=", memberId)
          .where("status", "in", ["selected", "playing"])
          .select("id")
          .executeTakeFirst();

        if (existing) {
          throw new ActionError({
            code: "CONFLICT",
            message: "This player is already in the squad.",
          });
        }
      }

      const id = randomUUID();
      await client
        .insertInto("matchday_player")
        .values({
          id,
          matchday_id: matchdayId,
          member_id: memberId ?? null,
          player_name: playerName,
          status: "selected",
        })
        .execute();

      // If this is an ad-hoc player (no member_id), create a member record
      if (!memberId && playerName.trim()) {
        const newMemberId = randomUUID();
        await client
          .insertInto("member")
          .values({
            id: newMemberId,
            name: playerName,
            email: "",
            title: "",
            address: "",
            postcode: "",
            dob: "",
            telephone: "",
            emergency_contact_name: "",
            emergency_contact_telephone: "",
            member_category: "guest",
          })
          .execute();

        // Link the matchday_player to the new member
        await client
          .updateTable("matchday_player")
          .set({ member_id: newMemberId })
          .where("id", "=", id)
          .execute();
      }

      return { id };
    },
  }),

  /** Remove a player from a matchday squad. */
  removePlayer: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayPlayerId: z.string(),
    }),
    handler: async ({ matchdayPlayerId }, { user }) => {
      const player = await client
        .selectFrom("matchday_player")
        .innerJoin("matchday", "matchday.id", "matchday_player.matchday_id")
        .where("matchday_player.id", "=", matchdayPlayerId)
        .select([
          "matchday_player.id",
          "matchday.play_cricket_team_id",
          "matchday.status as matchday_status",
        ])
        .executeTakeFirst();

      if (!player) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Player not found.",
        });
      }

      if (player.matchday_status === "finished") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Cannot remove players from a finished matchday.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(player.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      await client
        .deleteFrom("matchday_player")
        .where("id", "=", matchdayPlayerId)
        .execute();

      return { success: true };
    },
  }),
};
