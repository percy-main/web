import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import { send } from "@/lib/email/send";
import * as playCricketApi from "@/lib/play-cricket";
import { render } from "@react-email/render";
import { ActionError } from "astro:actions";
import { BASE_URL } from "astro:env/client";
import { PLAY_CRICKET_SITE_ID } from "astro:env/server";
import { z } from "astro/zod";
import { storeReceiptImage } from "@/lib/blobs";
import { randomUUID } from "crypto";
import { parse, isBefore, startOfDay, subDays, formatDate } from "date-fns";
import { ChargeNotification } from "~/emails/ChargeNotification";

const EXPENSE_TYPES = [
  "umpire_fee",
  "scorer_fee",
  "match_ball",
  "teas",
  "miscellaneous",
] as const;
const expenseTypeSchema = z.enum(EXPENSE_TYPES);

const PAYMENT_METHODS = ["cash", "bank_transfer", "card"] as const;
const paymentMethodSchema = z.enum(PAYMENT_METHODS);

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

/**
 * Find the best matching fee rate. Priority:
 * 1. team + competition + category
 * 2. team + any competition + category
 * 3. any team + competition + category
 * 4. any team + any competition + category
 */
function findFeeRate(
  rates: Array<{
    play_cricket_team_id: string | null;
    competition_type: string | null;
    member_category: string;
    amount_pence: number;
  }>,
  teamId: string,
  competitionType: string | null,
  category: string,
) {
  return (
    rates.find(
      (r) =>
        r.play_cricket_team_id === teamId &&
        r.competition_type === competitionType &&
        r.member_category === category,
    ) ??
    rates.find(
      (r) =>
        r.play_cricket_team_id === teamId &&
        r.competition_type === null &&
        r.member_category === category,
    ) ??
    rates.find(
      (r) =>
        r.play_cricket_team_id === null &&
        r.competition_type === competitionType &&
        r.member_category === category,
    ) ??
    rates.find(
      (r) =>
        r.play_cricket_team_id === null &&
        r.competition_type === null &&
        r.member_category === category,
    )
  );
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
      const currentYear = now.getFullYear();
      // Fetch both current and next season when in Jan-Mar (fixtures for
      // the upcoming season are already published in Play-Cricket)
      const seasons =
        now.getMonth() < 3
          ? [currentYear - 1, currentYear]
          : [currentYear];
      const summaries = await Promise.all(
        seasons.map((season) => playCricketApi.getMatchesSummary({ season })),
      );
      const allMatches = summaries.flatMap((s) => s.matches);

      // Filter to matches involving this team, from today onwards (include today)
      const cutoff = startOfDay(subDays(now, 1));

      const upcoming = allMatches
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
      competitionType: z.string().optional(),
      playCricketMatchId: z.string().optional(),
    }),
    handler: async ({ teamId, matchDate, opposition, competitionType, playCricketMatchId }, { user }) => {
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
          competition_type: competitionType ?? null,
          play_cricket_match_id: playCricketMatchId ?? null,
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
        .leftJoin("charge", "charge.id", "matchday_player.charge_id")
        .select([
          "matchday_player.id",
          "matchday_player.member_id",
          "matchday_player.player_name",
          "matchday_player.status",
          "matchday_player.replaced_by_matchday_player_id",
          "matchday_player.charge_id",
          "matchday_player.created_at",
          "member.member_category",
          "charge.paid_at as chargePaidAt",
        ])
        .orderBy("matchday_player.created_at", "asc")
        .execute();

      const team = await client
        .selectFrom("play_cricket_team")
        .where("id", "=", matchday.play_cricket_team_id)
        .select(["id", "name"])
        .executeTakeFirst();

      const expenses = await client
        .selectFrom("matchday_expense")
        .where("matchday_id", "=", matchdayId)
        .selectAll()
        .orderBy("created_at", "asc")
        .execute();

      return {
        matchday,
        team: team ?? null,
        players,
        expenses,
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

      // Use transaction to ensure matchday_player and guest member are created atomically
      await client.transaction().execute(async (trx) => {
        let finalMemberId = memberId ?? null;

        // If this is an ad-hoc player (no member_id), create a guest member record first
        if (!memberId && playerName.trim()) {
          finalMemberId = randomUUID();
          await trx
            .insertInto("member")
            .values({
              id: finalMemberId,
              name: playerName,
              // These columns are NOT NULL in the schema, so we use empty string for guest placeholders
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
        }

        await trx
          .insertInto("matchday_player")
          .values({
            id,
            matchday_id: matchdayId,
            member_id: finalMemberId,
            player_name: playerName,
            status: "selected",
          })
          .execute();
      });

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

  /** Confirm the team and generate match fees. */
  confirmTeam: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayId: z.string(),
      playerStatuses: z.array(
        z.object({
          matchdayPlayerId: z.string(),
          status: z.enum(["playing", "dropped_out", "no_show"]),
        }),
      ),
    }),
    handler: async ({ matchdayId, playerStatuses }, { user }) => {
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

      if (matchday.status !== "pending") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Matchday has already been confirmed.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(matchday.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      // Update matchday status
      await client
        .updateTable("matchday")
        .set({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
        })
        .where("id", "=", matchdayId)
        .execute();

      // Validate all player IDs belong to this matchday
      const playerIds = playerStatuses.map((ps) => ps.matchdayPlayerId);
      if (playerIds.length > 0) {
        const validPlayers = await client
          .selectFrom("matchday_player")
          .where("matchday_id", "=", matchdayId)
          .where("id", "in", playerIds)
          .select("id")
          .execute();

        const validIds = new Set(validPlayers.map((p) => p.id));
        const invalid = playerIds.filter((id) => !validIds.has(id));
        if (invalid.length > 0) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "One or more player IDs do not belong to this matchday.",
          });
        }
      }

      // Update player statuses
      for (const { matchdayPlayerId, status } of playerStatuses) {
        await client
          .updateTable("matchday_player")
          .set({ status })
          .where("id", "=", matchdayPlayerId)
          .where("matchday_id", "=", matchdayId)
          .execute();
      }

      // Generate match fees for "playing" players
      const playingPlayers = await client
        .selectFrom("matchday_player")
        .leftJoin("member", "member.id", "matchday_player.member_id")
        .where("matchday_player.matchday_id", "=", matchdayId)
        .where("matchday_player.status", "=", "playing")
        .select([
          "matchday_player.id as matchdayPlayerId",
          "matchday_player.member_id",
          "matchday_player.player_name",
          "member.member_category",
        ])
        .execute();

      // Look up fee rates for this team
      const feeRates = await client
        .selectFrom("match_fee_rate")
        .where((eb) =>
          eb.or([
            eb("play_cricket_team_id", "=", matchday.play_cricket_team_id),
            eb("play_cricket_team_id", "is", null),
          ]),
        )
        .selectAll()
        .execute();

      for (const player of playingPlayers) {
        if (!player.member_id) continue;

        const category = player.member_category ?? "guest";

        // Skip bursary members (they pay nothing)
        if (category === "bursary") continue;

        const rate = findFeeRate(
          feeRates,
          matchday.play_cricket_team_id,
          matchday.competition_type,
          category,
        );

        if (!rate || rate.amount_pence === 0) continue;

        const chargeId = randomUUID();
        await client
          .insertInto("charge")
          .values({
            id: chargeId,
            member_id: player.member_id,
            description: `Match fee - ${matchday.opposition} (${formatDate(new Date(matchday.match_date), "dd/MM/yyyy")})`,
            amount_pence: rate.amount_pence,
            charge_date: matchday.match_date,
            created_by: user.id,
            type: "match_fee",
            source: "matchday",
          })
          .execute();

        // Link charge to matchday_player
        await client
          .updateTable("matchday_player")
          .set({ charge_id: chargeId })
          .where("id", "=", player.matchdayPlayerId)
          .execute();
      }

      return { success: true };
    },
  }),

  /** Update a single player's status (for replacements during confirmation). */
  updatePlayerStatus: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayPlayerId: z.string(),
      status: z.enum(["playing", "dropped_out", "no_show", "replaced"]),
    }),
    handler: async ({ matchdayPlayerId, status }, { user }) => {
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

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(player.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      await client
        .updateTable("matchday_player")
        .set({ status })
        .where("id", "=", matchdayPlayerId)
        .execute();

      return { success: true };
    },
  }),

  /** Mark a player's match fee as paid. */
  markMatchFeePaid: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayPlayerId: z.string(),
      paymentMethod: paymentMethodSchema,
    }),
    handler: async ({ matchdayPlayerId, paymentMethod }, { user }) => {
      const player = await client
        .selectFrom("matchday_player")
        .innerJoin("matchday", "matchday.id", "matchday_player.matchday_id")
        .where("matchday_player.id", "=", matchdayPlayerId)
        .select([
          "matchday_player.id",
          "matchday_player.charge_id",
          "matchday.play_cricket_team_id",
        ])
        .executeTakeFirst();

      if (!player) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Player not found.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(player.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      if (!player.charge_id) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No match fee charge found for this player.",
        });
      }

      await client
        .updateTable("charge")
        .set({
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
        })
        .where("id", "=", player.charge_id)
        .where("paid_at", "is", null)
        .execute();

      return { success: true };
    },
  }),

  /** List match fee rates (admin). */
  listMatchFeeRates: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const rates = await client
        .selectFrom("match_fee_rate")
        .leftJoin(
          "play_cricket_team",
          "play_cricket_team.id",
          "match_fee_rate.play_cricket_team_id",
        )
        .select([
          "match_fee_rate.id",
          "match_fee_rate.play_cricket_team_id",
          "match_fee_rate.competition_type",
          "match_fee_rate.member_category",
          "match_fee_rate.amount_pence",
          "play_cricket_team.name as team_name",
        ])
        .orderBy("match_fee_rate.member_category", "asc")
        .execute();

      return rates;
    },
  }),

  /** Add a match fee rate (admin). */
  addMatchFeeRate: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      playCricketTeamId: z.string().optional(),
      competitionType: z.string().optional(),
      memberCategory: z.string(),
      amountPence: z.number().int().min(0),
    }),
    handler: async ({
      playCricketTeamId,
      competitionType,
      memberCategory,
      amountPence,
    }) => {
      const id = randomUUID();
      await client
        .insertInto("match_fee_rate")
        .values({
          id,
          play_cricket_team_id: playCricketTeamId ?? null,
          competition_type: competitionType ?? null,
          member_category: memberCategory,
          amount_pence: amountPence,
        })
        .execute();

      return { id };
    },
  }),

  /** Delete a match fee rate (admin). */
  deleteMatchFeeRate: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      rateId: z.string(),
    }),
    handler: async ({ rateId }) => {
      await client
        .deleteFrom("match_fee_rate")
        .where("id", "=", rateId)
        .execute();

      return { success: true };
    },
  }),

  /** Finish a match — unpaid fees remain as charges and notifications are sent. */
  finishMatch: defineAuthAction({
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

      if (matchday.status !== "confirmed") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Can only finish a confirmed matchday.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(matchday.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      // Set matchday to finished
      await client
        .updateTable("matchday")
        .set({
          status: "finished",
          finished_at: new Date().toISOString(),
          finished_by: user.id,
        })
        .where("id", "=", matchdayId)
        .execute();

      // Create charges for any playing players who don't have one yet
      // (e.g. fee rates were added after team confirmation)
      const uncharged = await client
        .selectFrom("matchday_player")
        .leftJoin("member", "member.id", "matchday_player.member_id")
        .where("matchday_player.matchday_id", "=", matchdayId)
        .where("matchday_player.status", "=", "playing")
        .where("matchday_player.charge_id", "is", null)
        .select([
          "matchday_player.id as matchdayPlayerId",
          "matchday_player.member_id",
          "matchday_player.player_name",
          "member.member_category",
        ])
        .execute();

      if (uncharged.length > 0) {
        const feeRates = await client
          .selectFrom("match_fee_rate")
          .where((eb) =>
            eb.or([
              eb(
                "play_cricket_team_id",
                "=",
                matchday.play_cricket_team_id,
              ),
              eb("play_cricket_team_id", "is", null),
            ]),
          )
          .selectAll()
          .execute();

        for (const player of uncharged) {
          if (!player.member_id) continue;
          const category = player.member_category ?? "guest";
          if (category === "bursary") continue;

          const rate = findFeeRate(
            feeRates,
            matchday.play_cricket_team_id,
            matchday.competition_type,
            category,
          );

          if (!rate || rate.amount_pence === 0) continue;

          const chargeId = randomUUID();
          await client
            .insertInto("charge")
            .values({
              id: chargeId,
              member_id: player.member_id,
              description: `Match fee - ${matchday.opposition} (${formatDate(new Date(matchday.match_date), "dd/MM/yyyy")})`,
              amount_pence: rate.amount_pence,
              charge_date: matchday.match_date,
              created_by: user.id,
              type: "match_fee",
              source: "matchday",
            })
            .execute();

          await client
            .updateTable("matchday_player")
            .set({ charge_id: chargeId })
            .where("id", "=", player.matchdayPlayerId)
            .execute();
        }
      }

      // Find unpaid charges for this matchday and send notification emails
      const unpaidPlayers = await client
        .selectFrom("matchday_player")
        .innerJoin("charge", "charge.id", "matchday_player.charge_id")
        .innerJoin("member", "member.id", "matchday_player.member_id")
        .where("matchday_player.matchday_id", "=", matchdayId)
        .where("charge.paid_at", "is", null)
        .where("charge.deleted_at", "is", null)
        .select([
          "member.name as member_name",
          "member.email as member_email",
          "charge.description as charge_description",
          "charge.amount_pence",
          "charge.charge_date",
        ])
        .execute();

      const currencyFormatter = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      });

      // Send emails to members with unpaid fees (skip those without email)
      for (const player of unpaidPlayers) {
        if (!player.member_email) continue;

        const amountFormatted = currencyFormatter.format(
          player.amount_pence / 100,
        );

        await send({
          to: player.member_email,
          subject: ChargeNotification.subject,
          html: await render(
            <ChargeNotification.component
              imageBaseUrl={`${BASE_URL}/images`}
              name={player.member_name}
              description={player.charge_description}
              amount={amountFormatted}
              chargeDate={formatDate(new Date(player.charge_date), "dd/MM/yyyy")}
              loginUrl={`${BASE_URL}/auth/login`}
            />,
            { pretty: true },
          ),
        });
      }

      return {
        success: true,
        emailsSent: unpaidPlayers.filter((p) => p.member_email).length,
      };
    },
  }),

  /** Add an expense to a matchday. */
  addExpense: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayId: z.string(),
      expenseType: expenseTypeSchema,
      description: z.string().optional(),
      amountPence: z.number().int().min(0),
      receiptImage: z.string().optional(),
    }),
    handler: async ({ matchdayId, expenseType, description, amountPence, receiptImage }, { user }) => {
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

      if (matchday.status !== "confirmed") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: matchday.status === "pending"
            ? "Cannot add expenses to a pending matchday. Confirm the team first."
            : "Cannot add expenses to a finished matchday.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(matchday.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      // Store receipt image in blob storage if provided
      let receiptImageUrl: string | null = null;
      if (receiptImage) {
        // Validate data URL format
        const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
          receiptImage,
        );
        if (!match) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Invalid receipt image format.",
          });
        }
        const contentType = match[1];
        const imageBytes = new Uint8Array(
          Buffer.from(match[2], "base64"),
        );

        // Reject images larger than 500KB after decode
        if (imageBytes.byteLength > 500_000) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Receipt image is too large. Maximum size is 500KB.",
          });
        }

        const blobUrl = await storeReceiptImage(imageBytes, contentType);
        // If blob storage is available, use the blob URL; otherwise fall back
        // to storing the data URL directly in the DB (e.g. deploy previews)
        receiptImageUrl = blobUrl ?? receiptImage;
      }

      const id = randomUUID();
      await client
        .insertInto("matchday_expense")
        .values({
          id,
          matchday_id: matchdayId,
          expense_type: expenseType,
          description: description ?? null,
          amount_pence: amountPence,
          created_by: user.id,
          receipt_image_url: receiptImageUrl,
        })
        .execute();

      return { id };
    },
  }),

  /** Delete an expense from a matchday. */
  deleteExpense: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      expenseId: z.string(),
    }),
    handler: async ({ expenseId }, { user }) => {
      const expense = await client
        .selectFrom("matchday_expense")
        .innerJoin("matchday", "matchday.id", "matchday_expense.matchday_id")
        .where("matchday_expense.id", "=", expenseId)
        .select([
          "matchday_expense.id",
          "matchday.play_cricket_team_id",
          "matchday.status as matchday_status",
        ])
        .executeTakeFirst();

      if (!expense) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Expense not found.",
        });
      }

      if (expense.matchday_status === "finished") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Cannot delete expenses from a finished matchday.",
        });
      }

      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(expense.play_cricket_team_id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this matchday.",
        });
      }

      await client
        .deleteFrom("matchday_expense")
        .where("id", "=", expenseId)
        .execute();

      return { success: true };
    },
  }),

  /** Get a financial report for a matchday (admin only). */
  getMatchdayReport: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      matchdayId: z.string(),
    }),
    handler: async ({ matchdayId }) => {
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

      // Get players with charge info
      const players = await client
        .selectFrom("matchday_player")
        .leftJoin("member", "member.id", "matchday_player.member_id")
        .leftJoin("charge", "charge.id", "matchday_player.charge_id")
        .where("matchday_player.matchday_id", "=", matchdayId)
        .select([
          "matchday_player.id",
          "matchday_player.player_name",
          "matchday_player.status",
          "matchday_player.member_id",
          "member.member_category",
          "charge.amount_pence as charge_amount_pence",
          "charge.paid_at as charge_paid_at",
          "charge.payment_method as charge_payment_method",
          "charge.deleted_at as charge_deleted_at",
        ])
        .orderBy("matchday_player.created_at", "asc")
        .execute();

      // Get expenses
      const expenses = await client
        .selectFrom("matchday_expense")
        .where("matchday_id", "=", matchdayId)
        .selectAll()
        .orderBy("created_at", "asc")
        .execute();

      // Get team info
      const team = await client
        .selectFrom("play_cricket_team")
        .where("id", "=", matchday.play_cricket_team_id)
        .select(["id", "name"])
        .executeTakeFirst();

      // Get game sponsorship if we have a Play-Cricket match ID
      let sponsorship = null;
      if (matchday.play_cricket_match_id) {
        sponsorship = await client
          .selectFrom("game_sponsorship")
          .where("game_id", "=", matchday.play_cricket_match_id)
          .where("approved", "=", 1)
          .where("paid_at", "is not", null)
          .selectAll()
          .executeTakeFirst() ?? null;
      }

      // Calculate totals
      const activeCharges = players.filter(
        (p) => p.charge_amount_pence != null && p.charge_deleted_at == null,
      );
      const totalIncoming = activeCharges.reduce(
        (sum, p) => sum + (p.charge_amount_pence ?? 0),
        0,
      );
      const totalPaid = activeCharges
        .filter((p) => p.charge_paid_at != null)
        .reduce((sum, p) => sum + (p.charge_amount_pence ?? 0), 0);
      const totalOutstanding = totalIncoming - totalPaid;
      const totalExpenses = expenses.reduce(
        (sum, e) => sum + e.amount_pence,
        0,
      );
      const sponsorshipIncome = sponsorship?.amount_pence ?? 0;
      const profitLoss = totalIncoming + sponsorshipIncome - totalExpenses;

      return {
        matchday,
        team: team ?? null,
        players,
        expenses,
        sponsorship,
        summary: {
          totalIncoming,
          totalPaid,
          totalOutstanding,
          totalExpenses,
          sponsorshipIncome,
          profitLoss,
        },
      };
    },
  }),

  /** List matchdays for the admin game reports (admin only). */
  listMatchdays: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      teamId: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    handler: async ({ teamId, limit, offset }) => {
      let query = client
        .selectFrom("matchday")
        .leftJoin(
          "play_cricket_team",
          "play_cricket_team.id",
          "matchday.play_cricket_team_id",
        )
        .select([
          "matchday.id",
          "matchday.match_date",
          "matchday.opposition",
          "matchday.status",
          "matchday.play_cricket_team_id",
          "matchday.competition_type",
          "play_cricket_team.name as team_name",
        ])
        .orderBy("matchday.match_date", "desc");

      if (teamId) {
        query = query.where("matchday.play_cricket_team_id", "=", teamId);
      }

      let countQuery = client
        .selectFrom("matchday")
        .select(client.fn.countAll<number>().as("count"));

      if (teamId) {
        countQuery = countQuery.where("play_cricket_team_id", "=", teamId);
      }

      const total = await countQuery.executeTakeFirst();

      const matchdays = await query
        .limit(limit ?? 50)
        .offset(offset ?? 0)
        .execute();

      return {
        matchdays,
        total: total?.count ?? 0,
      };
    },
  }),

  /** Check for discrepancies between our confirmed team and Play-Cricket's team sheet. */
  checkDiscrepancies: defineAuthAction({
    roles: ["official", "admin"],
    input: z.object({
      matchdayId: z.string(),
      playCricketMatchId: z.string(),
    }),
    handler: async ({ matchdayId, playCricketMatchId }, { user }) => {
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

      // Get our confirmed playing squad
      const ourPlayers = await client
        .selectFrom("matchday_player")
        .where("matchday_id", "=", matchdayId)
        .where("status", "=", "playing")
        .select(["player_name", "member_id"])
        .execute();

      // Get Play-Cricket match details
      const { match_details } = await playCricketApi.getMatchDetail({
        matchId: playCricketMatchId,
      });

      const match = match_details[0];
      if (!match) {
        return {
          discrepancies: [],
          message: "Could not fetch Play-Cricket match details.",
        };
      }

      // Extract player names from Play-Cricket innings data
      const pcPlayerNames = new Set<string>();
      for (const inn of match.innings) {
        if (inn.team_batting_id === matchday.play_cricket_team_id) {
          for (const bat of inn.bat) {
            if (bat.batsman_name) pcPlayerNames.add(bat.batsman_name);
          }
        }
        // Check bowlers too
        for (const bowl of inn.bowl) {
          if (bowl.bowler_name) pcPlayerNames.add(bowl.bowler_name);
        }
      }

      const ourPlayerNames = new Set(ourPlayers.map((p) => p.player_name));

      const inOursNotPC = [...ourPlayerNames].filter(
        (name) => !pcPlayerNames.has(name),
      );
      const inPCNotOurs = [...pcPlayerNames].filter(
        (name) => !ourPlayerNames.has(name),
      );

      return {
        discrepancies: [
          ...inOursNotPC.map((name) => ({
            type: "in_ours_not_play_cricket" as const,
            playerName: name,
          })),
          ...inPCNotOurs.map((name) => ({
            type: "in_play_cricket_not_ours" as const,
            playerName: name,
          })),
        ],
        message:
          inOursNotPC.length === 0 && inPCNotOurs.length === 0
            ? "No discrepancies found."
            : null,
      };
    },
  }),
};
