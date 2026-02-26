import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import { getAgeGroup } from "@/lib/util/ageGroup";
import { ActionError } from "astro:actions";
import { z } from "astro:schema";

/**
 * Returns the user's role from the DB (the session User type from Better Auth
 * doesn't include the `role` field directly).
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
 * Returns the junior_team_ids the user is allowed to view.
 * Admins get all teams; junior_managers get their assigned teams.
 */
async function getAccessibleTeamIds(userId: string): Promise<string[]> {
  const role = await getUserRole(userId);

  if (role === "admin") {
    const allTeams = await client
      .selectFrom("junior_team")
      .select("id")
      .execute();
    return allTeams.map((t) => t.id).filter((id): id is string => id !== null);
  }

  const assignments = await client
    .selectFrom("junior_team_manager")
    .where("user_id", "=", userId)
    .select("junior_team_id")
    .execute();

  return assignments.map((a) => a.junior_team_id);
}

export const juniorManager = {
  /** List the teams assigned to the current user (or all teams for admins). */
  listMyTeams: defineAuthAction({
    roles: ["junior_manager", "admin"],
    handler: async (_, { user }) => {
      const accessibleIds = await getAccessibleTeamIds(user.id);

      if (accessibleIds.length === 0) {
        return [];
      }

      const teams = await client
        .selectFrom("junior_team")
        .where("id", "in", accessibleIds)
        .selectAll()
        .orderBy("age_group", "asc")
        .orderBy("sex", "asc")
        .execute();

      return teams;
    },
  }),

  /** List players (dependents) for a specific team. */
  listPlayers: defineAuthAction({
    roles: ["junior_manager", "admin"],
    input: z.object({
      teamId: z.string(),
    }),
    handler: async ({ teamId }, { user }) => {
      // Verify the user has access to this team
      const accessibleIds = await getAccessibleTeamIds(user.id);
      if (!accessibleIds.includes(teamId)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this team.",
        });
      }

      // Look up the team to get age_group and sex
      const team = await client
        .selectFrom("junior_team")
        .where("id", "=", teamId)
        .selectAll()
        .executeTakeFirst();

      if (!team) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Team not found.",
        });
      }

      // Get all dependents and filter by computed age group + sex match
      const rows = await client
        .selectFrom("dependent")
        .innerJoin("member", "member.id", "dependent.member_id")
        .where("dependent.sex", "=", team.sex)
        .select([
          "dependent.id",
          "dependent.name",
          "dependent.sex",
          "dependent.dob",
          "dependent.created_at as registeredAt",
          "member.name as parentName",
          "member.email as parentEmail",
          "member.telephone as parentTelephone",
          "member.address as parentAddress",
          "member.postcode as parentPostcode",
          "member.emergency_contact_name as emergencyContactName",
          "member.emergency_contact_telephone as emergencyContactTelephone",
        ])
        .orderBy("dependent.name", "asc")
        .execute();

      // Filter to only dependents whose computed age group matches the team's
      const players = rows.filter((row) => {
        const ageGroup = getAgeGroup(row.dob);
        return ageGroup === team.age_group;
      });

      return players.map((row) => ({
        id: row.id,
        name: row.name,
        sex: row.sex,
        dob: row.dob,
        registeredAt: row.registeredAt,
        parentName: row.parentName,
        parentEmail: row.parentEmail,
        parentTelephone: row.parentTelephone,
        parentAddress: row.parentAddress,
        parentPostcode: row.parentPostcode,
        emergencyContactName: row.emergencyContactName,
        emergencyContactTelephone: row.emergencyContactTelephone,
      }));
    },
  }),

  /** Get full details for a single player (dependent). Only accessible if the player is in one of the manager's teams. */
  getPlayerDetail: defineAuthAction({
    roles: ["junior_manager", "admin"],
    input: z.object({
      dependentId: z.string(),
    }),
    handler: async ({ dependentId }, { user }) => {
      const accessibleIds = await getAccessibleTeamIds(user.id);

      const row = await client
        .selectFrom("dependent")
        .innerJoin("member", "member.id", "dependent.member_id")
        .where("dependent.id", "=", dependentId)
        .select([
          "dependent.id",
          "dependent.name",
          "dependent.sex",
          "dependent.dob",
          "dependent.created_at as registeredAt",
          "member.name as parentName",
          "member.email as parentEmail",
          "member.telephone as parentTelephone",
          "member.address as parentAddress",
          "member.postcode as parentPostcode",
          "member.emergency_contact_name as emergencyContactName",
          "member.emergency_contact_telephone as emergencyContactTelephone",
        ])
        .executeTakeFirst();

      if (!row) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Player not found.",
        });
      }

      // Check team access: compute the player's team and verify it's accessible
      const ageGroup = getAgeGroup(row.dob);
      if (!ageGroup) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Player is not in a junior age group.",
        });
      }

      // Find the team that matches this player's age group + sex
      const matchingTeam = await client
        .selectFrom("junior_team")
        .where("age_group", "=", ageGroup)
        .where("sex", "=", row.sex)
        .select("id")
        .executeTakeFirst();

      if (!matchingTeam?.id || !accessibleIds.includes(matchingTeam.id)) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You do not have access to this player's team.",
        });
      }

      return {
        id: row.id,
        name: row.name,
        sex: row.sex,
        dob: row.dob,
        registeredAt: row.registeredAt,
        parentName: row.parentName,
        parentEmail: row.parentEmail,
        parentTelephone: row.parentTelephone,
        parentAddress: row.parentAddress,
        parentPostcode: row.parentPostcode,
        emergencyContactName: row.emergencyContactName,
        emergencyContactTelephone: row.emergencyContactTelephone,
      };
    },
  }),
};
