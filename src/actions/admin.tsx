import { defineAuthAction } from "@/lib/auth/api";
import { auth } from "@/lib/auth/server";
import { client } from "@/lib/db/client";
import { send } from "@/lib/email/send";
import { memberCategorySchema } from "@/lib/member/categories";
import { stripe } from "@/lib/payments/client";
import { syncStripeCharges } from "@/lib/payments/syncStripeCharges";
import { AGE_GROUPS, getAgeGroup, getTeamName } from "@/lib/util/ageGroup";
import { nameSimilarity, normalizeName } from "@/lib/util/nameSimilarity";
import { render } from "@react-email/render";
import { ActionError } from "astro:actions";
import { BASE_URL } from "astro:env/client";
import { z } from "astro/zod";
import { randomUUID } from "crypto";
import { formatDate, subHours } from "date-fns";
import { sql } from "kysely";
import { ChargeNotification } from "~/emails/ChargeNotification";
import { PaymentReminder } from "~/emails/PaymentReminder";

const ABANDONED_THRESHOLD_HOURS = 1;

export const admin = {
  listUsers: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      search: z.string().optional(),
      includeArchived: z.boolean().default(false),
      isMember: z.enum(["all", "yes", "no"]).default("all"),
      membershipStatus: z.enum(["all", "active", "expired", "none"]).default("all"),
      membershipType: z.enum(["all", "senior_player", "senior_women_player", "social", "junior", "concessionary"]).default("all"),
      memberCategory: z.union([z.literal("all"), memberCategorySchema]).default("all"),
      role: z.enum(["all", "user", "admin", "official", "junior_manager"]).default("all"),
    }),
    handler: async ({ page, pageSize, search, includeArchived, isMember, membershipStatus, membershipType, memberCategory, role }) => {
      function applyFilters(
        q: ReturnType<
          typeof client.selectFrom<"user">
        >,
      ) {
        let filtered = q
          .leftJoin("member", "member.email", "user.email")
          .leftJoin("membership", (join) =>
            join
              .onRef("membership.member_id", "=", "member.id")
              .on("membership.dependent_id", "is", null),
          );

        if (!includeArchived) {
          filtered = filtered.where((eb) =>
            eb.or([
              eb("member.deleted_at", "is", null),
              eb("member.id", "is", null),
            ]),
          );
        }

        if (search && search.trim().length > 0) {
          const term = `%${search.trim()}%`;
          filtered = filtered.where((eb) =>
            eb.or([
              eb("user.name", "like", term),
              eb("user.email", "like", term),
            ]),
          );
        }

        if (isMember === "yes") {
          filtered = filtered.where("member.id", "is not", null);
        } else if (isMember === "no") {
          filtered = filtered.where("member.id", "is", null);
        }

        if (membershipStatus === "active") {
          filtered = filtered.where("membership.paid_until", ">=", new Date().toISOString());
        } else if (membershipStatus === "expired") {
          filtered = filtered
            .where("membership.paid_until", "is not", null)
            .where("membership.paid_until", "<", new Date().toISOString());
        } else if (membershipStatus === "none") {
          filtered = filtered.where("membership.paid_until", "is", null);
        }

        if (membershipType !== "all") {
          filtered = filtered.where("membership.type", "=", membershipType);
        }

        if (memberCategory !== "all") {
          filtered = filtered.where("member.member_category", "=", memberCategory);
        }

        if (role === "junior_manager") {
          filtered = filtered.where((eb) =>
            eb.exists(
              eb.selectFrom("junior_team_manager")
                .whereRef("junior_team_manager.user_id", "=", "user.id")
                .select(sql.lit(1).as("one"))
            )
          );
        } else if (role !== "all") {
          filtered = filtered.where("user.role", "=", role);
        }

        return filtered;
      }

      const countResult = await applyFilters(client.selectFrom("user"))
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirstOrThrow();

      const total = Number(countResult.total);
      const offset = (page - 1) * pageSize;

      const users = await applyFilters(client.selectFrom("user"))
        .select([
          "user.id",
          "user.name",
          "user.email",
          "user.role",
          "user.createdAt",
          "member.id as memberId",
          "member.member_category as memberCategory",
          "member.deleted_at as memberDeletedAt",
          "membership.type as membershipType",
          "membership.paid_until as paidUntil",
        ])
        .select((eb) => [
          eb
            .exists(
              eb
                .selectFrom("junior_team_manager")
                .whereRef("junior_team_manager.user_id", "=", "user.id")
                .select(sql.lit(1).as("one")),
            )
            .as("isJuniorManager"),
          eb
            .exists(
              eb
                .selectFrom("team_official")
                .whereRef("team_official.user_id", "=", "user.id")
                .select(sql.lit(1).as("one")),
            )
            .as("isOfficial"),
        ])
        .orderBy("user.createdAt", "desc")
        .limit(pageSize)
        .offset(offset)
        .execute();

      return {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          isMember: u.memberId !== null,
          isArchived: u.memberDeletedAt !== null,
          isJuniorManager: Boolean(u.isJuniorManager),
          isOfficial: Boolean(u.isOfficial),
          memberCategory: u.memberCategory ?? null,
          membershipType: u.membershipType ?? null,
          paidUntil: u.paidUntil ?? null,
        })),
        total,
        page,
        pageSize,
      };
    },
  }),

  getUserDetail: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      userId: z.string(),
    }),
    handler: async ({ userId }) => {
      const user = await client
        .selectFrom("user")
        .where("user.id", "=", userId)
        .select([
          "user.id",
          "user.name",
          "user.email",
          "user.role",
          "user.createdAt",
          "user.emailVerified",
        ])
        .select((eb) => [
          eb
            .exists(
              eb
                .selectFrom("junior_team_manager")
                .whereRef("junior_team_manager.user_id", "=", "user.id")
                .select(sql.lit(1).as("one")),
            )
            .as("isJuniorManager"),
          eb
            .exists(
              eb
                .selectFrom("team_official")
                .whereRef("team_official.user_id", "=", "user.id")
                .select(sql.lit(1).as("one")),
            )
            .as("isOfficial"),
        ])
        .executeTakeFirst();

      if (!user) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const member = await client
        .selectFrom("member")
        .where("member.email", "=", user.email)
        .select([
          "member.id",
          "member.title",
          "member.name",
          "member.email",
          "member.address",
          "member.postcode",
          "member.dob",
          "member.telephone",
          "member.emergency_contact_name",
          "member.emergency_contact_telephone",
          "member.member_category",
          "member.deleted_at",
          "member.deleted_reason",
        ])
        .executeTakeFirst();

      let membership = null;
      if (member) {
        membership =
          (await client
            .selectFrom("membership")
            .where("membership.member_id", "=", member.id)
            .select([
              "membership.id",
              "membership.type",
              "membership.paid_until",
              "membership.created_at",
            ])
            .executeTakeFirst()) ?? null;
      }

      // Fetch dependents if the user is a member
      const dependents = member
        ? await client
            .selectFrom("dependent")
            .leftJoin("membership", (join) =>
              join
                .onRef("dependent.id", "=", "membership.dependent_id")
                .on("membership.type", "=", "junior"),
            )
            .select([
              "dependent.id",
              "dependent.name",
              "dependent.sex",
              "dependent.dob",
              "dependent.school_year",
              "dependent.photo_consent",
              "dependent.has_disability",
              "dependent.disability_type",
              "dependent.medical_info",
              "dependent.gp_surgery",
              "dependent.gp_phone",
              "dependent.alt_contact_name",
              "dependent.alt_contact_phone",
              "dependent.emergency_medical_consent",
              "membership.paid_until",
            ])
            .where("dependent.member_id", "=", member.id)
            .execute()
        : [];

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          emailVerified: !!user.emailVerified,
          isJuniorManager: Boolean(user.isJuniorManager),
          isOfficial: Boolean(user.isOfficial),
        },
        member: member ?? null,
        membership,
        dependents,
      };
    },
  }),

  updateMemberCategory: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
      memberCategory: memberCategorySchema.nullable(),
    }),
    handler: async ({ memberId, memberCategory }) => {
      const member = await client
        .selectFrom("member")
        .where("id", "=", memberId)
        .select("id")
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      await client
        .updateTable("member")
        .set({ member_category: memberCategory })
        .where("id", "=", memberId)
        .execute();

      return { success: true };
    },
  }),

  listContactSubmissions: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      search: z.string().optional(),
    }),
    handler: async ({ page, pageSize, search }) => {
      let baseQuery = client.selectFrom("contact_submission");

      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb("contact_submission.name", "like", term),
            eb("contact_submission.email", "like", term),
          ]),
        );
      }

      const countResult = await baseQuery
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirstOrThrow();

      const total = Number(countResult.total);

      const offset = (page - 1) * pageSize;

      const submissions = await (() => {
        let q = client.selectFrom("contact_submission");

        if (search && search.trim().length > 0) {
          const term = `%${search.trim()}%`;
          q = q.where((eb) =>
            eb.or([
              eb("contact_submission.name", "like", term),
              eb("contact_submission.email", "like", term),
            ]),
          );
        }

        return q
          .select([
            "contact_submission.id",
            "contact_submission.name",
            "contact_submission.email",
            "contact_submission.message",
            "contact_submission.page",
            "contact_submission.created_at",
          ])
          .orderBy("contact_submission.created_at", "desc")
          .limit(pageSize)
          .offset(offset)
          .execute();
      })();

      return {
        submissions: submissions.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          message: s.message,
          page: s.page,
          createdAt: s.created_at,
        })),
        total,
        page,
        pageSize,
      };
    },
  }),

  setUserRole: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      userId: z.string(),
      role: z.enum(["user", "admin"]),
    }),
    handler: async ({ userId, role }, _session, context) => {
      // When changing to user or admin, clean up any junior_manager and official team assignments
      await client
        .deleteFrom("junior_team_manager")
        .where("user_id", "=", userId)
        .execute();
      await client
        .deleteFrom("team_official")
        .where("user_id", "=", userId)
        .execute();

      await auth.api.setRole({
        headers: context.request.headers,
        body: {
          userId,
          role,
        },
      });

      return { success: true };
    },
  }),

  listJuniorTeams: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const teams = await client
        .selectFrom("junior_team")
        .selectAll()
        .orderBy("age_group", "asc")
        .orderBy("sex", "asc")
        .execute();

      return teams;
    },
  }),

  getJuniorManagerTeams: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      userId: z.string(),
    }),
    handler: async ({ userId }) => {
      const assignments = await client
        .selectFrom("junior_team_manager")
        .where("user_id", "=", userId)
        .select("junior_team_id")
        .execute();

      return assignments.map((a) => a.junior_team_id);
    },
  }),

  setJuniorManager: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      userId: z.string(),
      teamIds: z.array(z.string()),
    }),
    handler: async ({ userId, teamIds }) => {
      // Verify the target user exists
      const targetUser = await client
        .selectFrom("user")
        .where("id", "=", userId)
        .select(["id", "role"])
        .executeTakeFirst();

      if (!targetUser) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Don't allow changing an admin's role via this action
      if (targetUser.role === "admin") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Cannot assign junior manager role to an admin. Demote them first.",
        });
      }

      // Clear existing team assignments (both junior_manager and official)
      await client
        .deleteFrom("junior_team_manager")
        .where("user_id", "=", userId)
        .execute();
      await client
        .deleteFrom("team_official")
        .where("user_id", "=", userId)
        .execute();

      if (teamIds.length > 0) {
        // Validate all team IDs exist
        const existingTeams = await client
          .selectFrom("junior_team")
          .select("id")
          .execute();

        const validIds = new Set(
          existingTeams.map((t) => t.id).filter((id): id is string => id !== null),
        );
        for (const id of teamIds) {
          if (!validIds.has(id)) {
            throw new ActionError({
              code: "BAD_REQUEST",
              message: "Invalid team ID",
            });
          }
        }

        // Insert new assignments
        for (const teamId of teamIds) {
          await client
            .insertInto("junior_team_manager")
            .values({
              user_id: userId,
              junior_team_id: teamId,
            })
            .execute();
        }

        // Set role to junior_manager directly in DB
        // (Better Auth's setRole only knows "user"/"admin", so we update directly)
        await client
          .updateTable("user")
          .set({ role: "junior_manager" })
          .where("id", "=", userId)
          .execute();
      } else {
        // No teams assigned — revert to user role
        await client
          .updateTable("user")
          .set({ role: "user" })
          .where("id", "=", userId)
          .execute();
      }

      return { success: true };
    },
  }),

  listPlayCricketTeams: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const teams = await client
        .selectFrom("play_cricket_team")
        .select(["id", "name", "is_junior"])
        .orderBy("name", "asc")
        .execute();

      return teams.filter(
        (t): t is typeof t & { id: string } => t.id !== null,
      );
    },
  }),

  getOfficialTeams: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      userId: z.string(),
    }),
    handler: async ({ userId }) => {
      const assignments = await client
        .selectFrom("team_official")
        .where("user_id", "=", userId)
        .select("play_cricket_team_id")
        .execute();

      return assignments.map((a) => a.play_cricket_team_id);
    },
  }),

  setOfficial: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      userId: z.string(),
      teamIds: z.array(z.string()),
    }),
    handler: async ({ userId, teamIds }) => {
      const targetUser = await client
        .selectFrom("user")
        .where("id", "=", userId)
        .select(["id", "role"])
        .executeTakeFirst();

      if (!targetUser) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (targetUser.role === "admin") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "Cannot assign official role to an admin. Demote them first.",
        });
      }

      // Clear existing official team assignments
      await client
        .deleteFrom("team_official")
        .where("user_id", "=", userId)
        .execute();

      if (teamIds.length > 0) {
        // Validate all team IDs exist
        const existingTeams = await client
          .selectFrom("play_cricket_team")
          .select("id")
          .execute();

        const validIds = new Set(
          existingTeams
            .map((t) => t.id)
            .filter((id): id is string => id !== null),
        );
        for (const id of teamIds) {
          if (!validIds.has(id)) {
            throw new ActionError({
              code: "BAD_REQUEST",
              message: "Invalid team ID",
            });
          }
        }

        // Insert new assignments
        for (const teamId of teamIds) {
          await client
            .insertInto("team_official")
            .values({
              user_id: userId,
              play_cricket_team_id: teamId,
            })
            .execute();
        }

        // Set role to official directly in DB
        await client
          .updateTable("user")
          .set({ role: "official" })
          .where("id", "=", userId)
          .execute();
      } else {
        // No teams assigned — revert to user role
        await client
          .updateTable("user")
          .set({ role: "user" })
          .where("id", "=", userId)
          .execute();
      }

      return { success: true };
    },
  }),

  addCharge: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
      description: z.string().min(1),
      amountPence: z.number().int().positive(),
      chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
    }),
    handler: async ({ memberId, description, amountPence, chargeDate }, session) => {
      const member = await client
        .selectFrom("member")
        .where("id", "=", memberId)
        .select(["id", "name", "email"])
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      const id = randomUUID();

      await client
        .insertInto("charge")
        .values({
          id,
          member_id: memberId,
          description,
          amount_pence: amountPence,
          charge_date: chargeDate,
          created_by: session.user.id,
          type: "manual",
          source: "admin",
        })
        .execute();

      const charge = await client
        .selectFrom("charge")
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirstOrThrow();

      const amountFormatted = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(amountPence / 100);

      await send({
        to: member.email,
        subject: ChargeNotification.subject,
        html: await render(
          <ChargeNotification.component
            imageBaseUrl={`${BASE_URL}/images`}
            name={member.name ?? "Member"}
            description={description}
            amount={amountFormatted}
            chargeDate={formatDate(chargeDate, "dd/MM/yyyy")}
            loginUrl={`${BASE_URL}/auth/login`}
          />,
          { pretty: true },
        ),
      });

      return charge;
    },
  }),

  getCharges: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
    }),
    handler: async ({ memberId }) => {
      const charges = await client
        .selectFrom("charge")
        .where("member_id", "=", memberId)
        .where("deleted_at", "is", null)
        .selectAll()
        .orderBy("charge_date", "desc")
        .execute();

      return charges;
    },
  }),

  deleteCharge: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      chargeId: z.string(),
      reason: z.string().min(1),
    }),
    handler: async ({ chargeId, reason }, session) => {
      const result = await client
        .updateTable("charge")
        .set({
          deleted_at: new Date().toISOString(),
          deleted_by: session.user.id,
          deleted_reason: reason,
        })
        .where("id", "=", chargeId)
        .where("paid_at", "is", null)
        .where("payment_confirmed_at", "is", null)
        .where("deleted_at", "is", null)
        .execute();

      if (result[0]?.numUpdatedRows === 0n) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "Charge not found or has already been paid/deleted",
        });
      }

      return { success: true };
    },
  }),

  listJuniors: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      search: z.string().optional(),
      sex: z.enum(["all", "male", "female"]).default("all"),
      ageGroup: z.enum(["all", ...AGE_GROUPS]).default("all"),
      membershipStatus: z.enum(["all", "paid", "unpaid"]).default("all"),
    }),
    handler: async ({ page, pageSize, search, sex, ageGroup, membershipStatus }) => {
      function buildBaseQuery() {
        let q = client
          .selectFrom("dependent")
          .innerJoin("member", "member.id", "dependent.member_id")
          .leftJoin("membership", (join) =>
            join
              .onRef("membership.dependent_id", "=", "dependent.id")
              .on("membership.type", "=", "junior"),
          )
          .leftJoin("user", "user.id", "dependent.user_id")
          .where("member.deleted_at", "is", null);

        // sex filter at SQL level
        if (sex !== "all") {
          q = q.where("dependent.sex", "=", sex);
        }

        // search filter at SQL level
        if (search && search.trim().length > 0) {
          const term = `%${search.trim()}%`;
          q = q.where((eb) =>
            eb.or([
              eb("dependent.name", "like", term),
              eb("member.name", "like", term),
            ]),
          );
        }

        return q;
      }

      // Fetch all matching rows (before ageGroup/membership post-filters)
      const allRows = await buildBaseQuery()
        .select([
          "dependent.id",
          "dependent.name",
          "dependent.sex",
          "dependent.dob",
          "dependent.created_at as registeredAt",
          "member.name as parentName",
          "member.email as parentEmail",
          "member.telephone as parentTelephone",
          "membership.paid_until as paidUntil",
          "dependent.user_id as linkedUserId",
          "user.email as linkedUserEmail",
        ])
        .orderBy("dependent.name", "asc")
        .execute();

      // Post-query filters (computed from dob/paidUntil)
      const now = new Date();
      const filtered = allRows.filter((row) => {
        if (ageGroup !== "all" && getAgeGroup(row.dob) !== ageGroup) {
          return false;
        }
        if (membershipStatus === "paid" && !(row.paidUntil && new Date(row.paidUntil) >= now)) {
          return false;
        }
        if (membershipStatus === "unpaid" && (row.paidUntil && new Date(row.paidUntil) >= now)) {
          return false;
        }
        return true;
      });

      const total = filtered.length;
      const offset = (page - 1) * pageSize;
      const paged = filtered.slice(offset, offset + pageSize);

      return {
        juniors: paged.map((row) => ({
          id: row.id,
          name: row.name,
          sex: row.sex,
          dob: row.dob,
          registeredAt: row.registeredAt,
          parentName: row.parentName,
          parentEmail: row.parentEmail,
          parentTelephone: row.parentTelephone,
          paidUntil: row.paidUntil,
          ageGroup: getAgeGroup(row.dob),
          teamName: getTeamName(row.dob, row.sex),
          hasOwnAccount: row.linkedUserId != null,
          linkedUserEmail: row.linkedUserEmail ?? null,
        })),
        total,
        page,
        pageSize,
      };
    },
  }),

  linkDependentToUser: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      dependentId: z.string().min(1),
      userId: z.string().min(1),
    }),
    handler: async ({ dependentId, userId }) => {
      const dep = await client
        .selectFrom("dependent")
        .select(["id", "user_id"])
        .where("id", "=", dependentId)
        .executeTakeFirst();

      if (!dep) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Dependent not found",
        });
      }

      if (dep.user_id != null) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Dependent is already linked to a user. Unlink first.",
        });
      }

      const user = await client
        .selectFrom("user")
        .select("id")
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "User not found",
        });
      }

      await client
        .updateTable("dependent")
        .set({ user_id: userId })
        .where("id", "=", dependentId)
        .execute();

      return { success: true };
    },
  }),

  unlinkDependentUser: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      dependentId: z.string().min(1),
    }),
    handler: async ({ dependentId }) => {
      const result = await client
        .updateTable("dependent")
        .set({ user_id: null })
        .where("id", "=", dependentId)
        .execute();

      if (result[0]?.numUpdatedRows === 0n) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Dependent not found",
        });
      }

      return { success: true };
    },
  }),

  searchUsersForLinking: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      dependentId: z.string().min(1),
    }),
    handler: async ({ dependentId }) => {
      const dep = await client
        .selectFrom("dependent")
        .select("name")
        .where("id", "=", dependentId)
        .executeTakeFirst();

      if (!dep) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Dependent not found",
        });
      }

      const users = await client
        .selectFrom("user")
        .select(["id", "name", "email"])
        .execute();

      const scored = users
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          score: nameSimilarity(dep.name, u.name),
        }))
        .filter((u) => u.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      return { dependentName: dep.name, users: scored };
    },
  }),

  listAllCharges: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      status: z.enum(["all", "unpaid", "pending", "paid", "abandoned"]).default("all"),
      showDeleted: z.boolean().default(false),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().optional(),
    }),
    handler: async ({ page, pageSize, status, showDeleted, dateFrom, dateTo, search }) => {
      const abandonedCutoff = subHours(new Date(), ABANDONED_THRESHOLD_HOURS).toISOString();

      function applyFilters(
        baseQuery: ReturnType<typeof client.selectFrom<"charge">>,
      ) {
        let q = baseQuery
          .innerJoin("member", "member.id", "charge.member_id");

        // Deleted filter
        if (!showDeleted) {
          q = q.where("charge.deleted_at", "is", null);
        }

        // Status filter
        if (status === "paid") {
          q = q.where("charge.paid_at", "is not", null);
        } else if (status === "pending") {
          q = q
            .where("charge.payment_confirmed_at", "is not", null)
            .where("charge.paid_at", "is", null)
            .where("charge.deleted_at", "is", null);
        } else if (status === "unpaid") {
          q = q
            .where("charge.paid_at", "is", null)
            .where("charge.payment_confirmed_at", "is", null)
            .where("charge.deleted_at", "is", null)
            .where((eb) =>
              eb.or([
                eb("charge.stripe_payment_intent_id", "is", null),
                eb("charge.created_at", ">=", abandonedCutoff),
              ]),
            );
        } else if (status === "abandoned") {
          q = q
            .where("charge.stripe_payment_intent_id", "is not", null)
            .where("charge.paid_at", "is", null)
            .where("charge.payment_confirmed_at", "is", null)
            .where("charge.deleted_at", "is", null)
            .where("charge.created_at", "<", abandonedCutoff);
        }

        // Date range filter
        if (dateFrom) {
          q = q.where("charge.charge_date", ">=", dateFrom);
        }
        if (dateTo) {
          q = q.where("charge.charge_date", "<=", dateTo);
        }

        // Search filter
        if (search && search.trim().length > 0) {
          const term = `%${search.trim()}%`;
          q = q.where((eb) =>
            eb.or([
              eb("member.name", "like", term),
              eb("member.email", "like", term),
              eb("charge.description", "like", term),
            ]),
          );
        }

        return q;
      }

      const countQuery = applyFilters(client.selectFrom("charge"));
      const countResult = await countQuery
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirstOrThrow();

      const total = Number(countResult.total);
      const offset = (page - 1) * pageSize;

      const dataQuery = applyFilters(client.selectFrom("charge"));
      const charges = await dataQuery
        .select([
          "charge.id",
          "charge.member_id",
          "charge.description",
          "charge.amount_pence",
          "charge.charge_date",
          "charge.created_at",
          "charge.paid_at",
          "charge.payment_confirmed_at",
          "charge.stripe_payment_intent_id",
          "charge.type",
          "charge.source",
          "charge.deleted_at",
          "charge.deleted_reason",
          "member.name as memberName",
          "member.email as memberEmail",
        ])
        .orderBy("charge.charge_date", "desc")
        .limit(pageSize)
        .offset(offset)
        .execute();

      return {
        charges: charges.map((c) => ({
          id: c.id,
          memberId: c.member_id,
          description: c.description,
          amountPence: c.amount_pence,
          chargeDate: c.charge_date,
          createdAt: c.created_at,
          paidAt: c.paid_at,
          paymentConfirmedAt: c.payment_confirmed_at,
          stripePaymentIntentId: c.stripe_payment_intent_id,
          type: c.type,
          source: c.source,
          deletedAt: c.deleted_at,
          deletedReason: c.deleted_reason,
          memberName: c.memberName,
          memberEmail: c.memberEmail,
          status: getChargeStatus(c.paid_at, c.payment_confirmed_at, c.deleted_at, c.stripe_payment_intent_id, abandonedCutoff, c.created_at),
        })),
        total,
        page,
        pageSize,
      };
    },
  }),

  getChargeAggregates: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
    handler: async ({ dateFrom, dateTo }) => {
      const abandonedCutoff = subHours(new Date(), ABANDONED_THRESHOLD_HOURS).toISOString();

      let baseQuery = client
        .selectFrom("charge")
        .innerJoin("member", "member.id", "charge.member_id");

      if (dateFrom) {
        baseQuery = baseQuery.where("charge.charge_date", ">=", dateFrom);
      }
      if (dateTo) {
        baseQuery = baseQuery.where("charge.charge_date", "<=", dateTo);
      }

      const result = await baseQuery
        .select([
          sql<number>`COALESCE(SUM(CASE WHEN charge.deleted_at IS NULL THEN charge.amount_pence ELSE 0 END), 0)`.as("totalCharged"),
          sql<number>`COALESCE(SUM(CASE WHEN charge.paid_at IS NOT NULL THEN charge.amount_pence ELSE 0 END), 0)`.as("totalPaid"),
          sql<number>`COALESCE(SUM(CASE WHEN charge.paid_at IS NULL AND charge.deleted_at IS NULL THEN charge.amount_pence ELSE 0 END), 0)`.as("totalOutstanding"),
          sql<number>`COALESCE(SUM(CASE WHEN charge.stripe_payment_intent_id IS NOT NULL AND charge.paid_at IS NULL AND charge.payment_confirmed_at IS NULL AND charge.deleted_at IS NULL AND charge.created_at < ${abandonedCutoff} THEN charge.amount_pence ELSE 0 END), 0)`.as("totalAbandoned"),
          sql<number>`COALESCE(SUM(CASE WHEN charge.deleted_at IS NOT NULL THEN charge.amount_pence ELSE 0 END), 0)`.as("totalDeleted"),
          sql<number>`COUNT(CASE WHEN charge.paid_at IS NOT NULL THEN 1 END)`.as("countPaid"),
          sql<number>`COUNT(CASE WHEN charge.paid_at IS NULL AND charge.payment_confirmed_at IS NULL AND charge.deleted_at IS NULL AND (charge.stripe_payment_intent_id IS NULL OR charge.created_at >= ${abandonedCutoff}) THEN 1 END)`.as("countUnpaid"),
          sql<number>`COUNT(CASE WHEN charge.payment_confirmed_at IS NOT NULL AND charge.paid_at IS NULL AND charge.deleted_at IS NULL THEN 1 END)`.as("countPending"),
          sql<number>`COUNT(CASE WHEN charge.stripe_payment_intent_id IS NOT NULL AND charge.paid_at IS NULL AND charge.payment_confirmed_at IS NULL AND charge.deleted_at IS NULL AND charge.created_at < ${abandonedCutoff} THEN 1 END)`.as("countAbandoned"),
          sql<number>`COUNT(CASE WHEN charge.deleted_at IS NOT NULL THEN 1 END)`.as("countDeleted"),
        ])
        .executeTakeFirstOrThrow();

      return {
        totalCharged: result.totalCharged,
        totalPaid: result.totalPaid,
        totalOutstanding: result.totalOutstanding,
        totalAbandoned: result.totalAbandoned,
        totalDeleted: result.totalDeleted,
        countPaid: result.countPaid,
        countUnpaid: result.countUnpaid,
        countPending: result.countPending,
        countAbandoned: result.countAbandoned,
        countDeleted: result.countDeleted,
      };
    },
  }),

  chasePayment: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      chargeId: z.string(),
    }),
    handler: async ({ chargeId }) => {
      const charge = await client
        .selectFrom("charge")
        .innerJoin("member", "member.id", "charge.member_id")
        .where("charge.id", "=", chargeId)
        .where("charge.paid_at", "is", null)
        .where("charge.deleted_at", "is", null)
        .select([
          "charge.id",
          "charge.description",
          "charge.amount_pence",
          "charge.charge_date",
          "member.name as memberName",
          "member.email as memberEmail",
        ])
        .executeTakeFirst();

      if (!charge) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Charge not found or already paid/deleted",
        });
      }

      const amountFormatted = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(charge.amount_pence / 100);

      await send({
        to: charge.memberEmail,
        subject: PaymentReminder.subject,
        html: await render(
          <PaymentReminder.component
            imageBaseUrl={`${BASE_URL}/images`}
            name={charge.memberName ?? "Member"}
            description={charge.description}
            amount={amountFormatted}
            chargeDate={formatDate(charge.charge_date, "dd/MM/yyyy")}
            loginUrl={`${BASE_URL}/auth/login`}
          />,
          { pretty: true },
        ),
      });

      return { success: true };
    },
  }),

  syncStripeHistory: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      return await syncStripeCharges();
    },
  }),

  findDuplicateMembers: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const NAME_SIMILARITY_THRESHOLD = 0.7;

      // Fetch all non-archived members
      const allMembers = await client
        .selectFrom("member")
        .where("deleted_at", "is", null)
        .select(["id", "name", "email", "title", "stripe_customer_id"])
        .execute();

      const allIds = allMembers.map((m) => m.id);
      const memberById = new Map(allMembers.map((m) => [m.id, m]));

      // Batch-fetch counts for all members
      const [membershipCounts, dependentCounts, chargeCounts] =
        allIds.length > 0
          ? await Promise.all([
              client
                .selectFrom("membership")
                .where("member_id", "in", allIds)
                .select(["member_id", sql<number>`COUNT(*)`.as("count")])
                .groupBy("member_id")
                .execute(),
              client
                .selectFrom("dependent")
                .where("member_id", "in", allIds)
                .select(["member_id", sql<number>`COUNT(*)`.as("count")])
                .groupBy("member_id")
                .execute(),
              client
                .selectFrom("charge")
                .where("member_id", "in", allIds)
                .select(["member_id", sql<number>`COUNT(*)`.as("count")])
                .groupBy("member_id")
                .execute(),
            ])
          : [[], [], []];

      const mcMap = Object.fromEntries(
        membershipCounts.map((r) => [r.member_id, r.count]),
      );
      const dcMap = Object.fromEntries(
        dependentCounts.map((r) => [r.member_id, r.count]),
      );
      const ccMap = Object.fromEntries(
        chargeCounts.map((r) => [r.member_id, r.count]),
      );

      function toGroupMember(id: string) {
        const m = memberById.get(id);
        if (!m) throw new Error(`Member ${id} not found`);
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          title: m.title,
          stripeCustomerId: m.stripe_customer_id,
          membershipCount: mcMap[m.id] ?? 0,
          dependentCount: dcMap[m.id] ?? 0,
          chargeCount: ccMap[m.id] ?? 0,
        };
      }

      // 1. Build email duplicate groups
      const emailBuckets = new Map<string, string[]>();
      for (const m of allMembers) {
        const ids = emailBuckets.get(m.email) ?? [];
        ids.push(m.id);
        emailBuckets.set(m.email, ids);
      }

      const emailGroups: Array<{
        matchType: "email";
        matchKey: string;
        members: Array<ReturnType<typeof toGroupMember>>;
      }> = [];

      // Track which pairs are already in an email group
      const emailLinked = new Set<string>();
      for (const [email, ids] of emailBuckets) {
        if (ids.length < 2) continue;
        emailGroups.push({
          matchType: "email",
          matchKey: email,
          members: ids.map(toGroupMember),
        });
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            emailLinked.add([ids[i], ids[j]].sort().join(":"));
          }
        }
      }

      // 2. Build name duplicate groups (fuzzy matching)
      // Pre-bucket by normalised surname to avoid O(n²) comparisons
      const surnameBuckets = new Map<string, typeof allMembers>();
      for (const m of allMembers) {
        if (!m.name) continue;
        const normalized = normalizeName(m.name);
        const tokens = normalized.split(" ");
        const surname = tokens[tokens.length - 1] ?? "";
        if (!surname) continue;
        const bucket = surnameBuckets.get(surname) ?? [];
        bucket.push(m);
        surnameBuckets.set(surname, bucket);
      }

      // Find pairwise matches within each surname bucket
      // Use direct pairs (not transitive union-find) to avoid false-positive chains
      const nameGroupMap = new Map<string, Set<string>>();
      for (const bucket of surnameBuckets.values()) {
        if (bucket.length < 2) continue;
        for (let i = 0; i < bucket.length; i++) {
          for (let j = i + 1; j < bucket.length; j++) {
            const a = bucket[i];
            const b = bucket[j];
            const pairKey = [a.id, b.id].sort().join(":");
            if (emailLinked.has(pairKey)) continue;

            const sim = nameSimilarity(a.name ?? "", b.name ?? "");
            if (sim >= NAME_SIMILARITY_THRESHOLD) {
              // Create a group keyed by the pair (not transitive)
              const existing = nameGroupMap.get(a.id) ?? new Set<string>();
              existing.add(a.id);
              existing.add(b.id);
              nameGroupMap.set(a.id, existing);
            }
          }
        }
      }

      // Deduplicate: merge overlapping sets that share a member
      const seen = new Set<string>();
      const nameGroups: Array<{
        matchType: "name";
        matchKey: string;
        members: Array<ReturnType<typeof toGroupMember>>;
      }> = [];
      for (const [anchor, ids] of nameGroupMap) {
        if (seen.has(anchor)) continue;
        for (const id of ids) seen.add(id);
        const first = memberById.get(anchor);
        nameGroups.push({
          matchType: "name",
          matchKey: first?.name ?? "Unknown",
          members: [...ids].map(toGroupMember),
        });
      }

      // Email groups first (higher confidence), then name groups
      return [...emailGroups, ...nameGroups];
    },
  }),

  getMergePreview: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      keepMemberId: z.string(),
      removeMemberId: z.string(),
    }),
    handler: async ({ keepMemberId, removeMemberId }) => {
      if (keepMemberId === removeMemberId) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Cannot merge a member with itself" });
      }

      const [keepMember, removeMember] = await Promise.all([
        client.selectFrom("member").where("id", "=", keepMemberId).selectAll().executeTakeFirst(),
        client.selectFrom("member").where("id", "=", removeMemberId).selectAll().executeTakeFirst(),
      ]);

      if (!keepMember || !removeMember) {
        throw new ActionError({ code: "NOT_FOUND", message: "One or both member records not found" });
      }

      const [keepMemberships, removeMemberships] = await Promise.all([
        client.selectFrom("membership").where("member_id", "=", keepMemberId).selectAll().execute(),
        client.selectFrom("membership").where("member_id", "=", removeMemberId).selectAll().execute(),
      ]);

      const [keepDependents, removeDependents] = await Promise.all([
        client.selectFrom("dependent").where("member_id", "=", keepMemberId).selectAll().execute(),
        client.selectFrom("dependent").where("member_id", "=", removeMemberId).selectAll().execute(),
      ]);

      const [keepCharges, removeCharges] = await Promise.all([
        client.selectFrom("charge").where("member_id", "=", keepMemberId).selectAll().execute(),
        client.selectFrom("charge").where("member_id", "=", removeMemberId).selectAll().execute(),
      ]);

      return {
        isCrossEmailMerge: keepMember.email !== removeMember.email,
        keep: {
          member: keepMember,
          memberships: keepMemberships,
          dependents: keepDependents,
          charges: keepCharges,
        },
        remove: {
          member: removeMember,
          memberships: removeMemberships,
          dependents: removeDependents,
          charges: removeCharges,
        },
      };
    },
  }),

  archiveMember: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
      reason: z.string().min(1),
    }),
    handler: async ({ memberId, reason }, session) => {
      const member = await client
        .selectFrom("member")
        .where("id", "=", memberId)
        .select(["id", "email", "stripe_customer_id", "deleted_at"])
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (member.deleted_at) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Member is already archived",
        });
      }

      // Check for active or trialing Stripe subscriptions
      if (member.stripe_customer_id) {
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: member.stripe_customer_id,
          });

          const hasActiveSub = subscriptions.data.some(
            (s) => s.status === "active" || s.status === "trialing",
          );

          if (hasActiveSub) {
            throw new ActionError({
              code: "BAD_REQUEST",
              message:
                "Cannot archive a member with an active Stripe subscription. Cancel their subscription first.",
            });
          }
        } catch (e) {
          if (e instanceof ActionError) throw e;
          console.error("Failed to check Stripe subscriptions:", e);
          throw new ActionError({
            code: "BAD_REQUEST",
            message:
              "Unable to verify Stripe subscription status. Please check their subscriptions manually before archiving.",
          });
        }
      }

      const now = new Date().toISOString();

      // Archive the member
      await client
        .updateTable("member")
        .set({
          deleted_at: now,
          deleted_by: session.user.id,
          deleted_reason: reason,
        })
        .where("id", "=", memberId)
        .execute();

      // Dependents are implicitly archived via their parent's archive status.
      // Queries for dependents join on member, so archived parent = hidden dependents.

      // Ban the user account so they can't log in
      const user = await client
        .selectFrom("user")
        .where("email", "=", member.email)
        .select("id")
        .executeTakeFirst();

      if (user) {
        await client
          .updateTable("user")
          .set({
            banned: 1,
            banReason: `Member archived: ${reason}`,
          })
          .where("id", "=", user.id)
          .execute();
      }

      return { success: true };
    },
  }),

  restoreMember: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
    }),
    handler: async ({ memberId }) => {
      const member = await client
        .selectFrom("member")
        .where("id", "=", memberId)
        .select(["id", "email", "deleted_at"])
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      if (!member.deleted_at) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Member is not archived",
        });
      }

      // Restore the member
      await client
        .updateTable("member")
        .set({
          deleted_at: null,
          deleted_by: null,
          deleted_reason: null,
        })
        .where("id", "=", memberId)
        .execute();

      // Unban the user account
      const user = await client
        .selectFrom("user")
        .where("email", "=", member.email)
        .select("id")
        .executeTakeFirst();

      if (user) {
        await client
          .updateTable("user")
          .set({
            banned: null,
            banReason: null,
            banExpires: null,
          })
          .where("id", "=", user.id)
          .execute();
      }

      return { success: true };
    },
  }),

  mergeMembers: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      keepMemberId: z.string(),
      removeMemberId: z.string(),
    }),
    handler: async ({ keepMemberId, removeMemberId }) => {
      if (keepMemberId === removeMemberId) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Cannot merge a member with itself" });
      }

      const [keepMember, removeMember] = await Promise.all([
        client.selectFrom("member").where("id", "=", keepMemberId).selectAll().executeTakeFirst(),
        client.selectFrom("member").where("id", "=", removeMemberId).selectAll().executeTakeFirst(),
      ]);

      if (!keepMember || !removeMember) {
        throw new ActionError({ code: "NOT_FOUND", message: "One or both member records not found" });
      }

      await client.transaction().execute(async (trx) => {
        // Re-point all foreign keys from removeMember to keepMember
        await trx
          .updateTable("membership")
          .set({ member_id: keepMemberId })
          .where("member_id", "=", removeMemberId)
          .execute();

        await trx
          .updateTable("dependent")
          .set({ member_id: keepMemberId })
          .where("member_id", "=", removeMemberId)
          .execute();

        await trx
          .updateTable("charge")
          .set({ member_id: keepMemberId })
          .where("member_id", "=", removeMemberId)
          .execute();

        // Preserve stripe_customer_id if keepMember doesn't have one
        if (!keepMember.stripe_customer_id && removeMember.stripe_customer_id) {
          await trx
            .updateTable("member")
            .set({ stripe_customer_id: removeMember.stripe_customer_id })
            .where("id", "=", keepMemberId)
            .execute();
        }

        // Delete the duplicate member record
        await trx
          .deleteFrom("member")
          .where("id", "=", removeMemberId)
          .execute();
      });

      return { success: true };
    },
  }),
};

function getChargeStatus(
  paidAt: string | null,
  paymentConfirmedAt: string | null,
  deletedAt: string | null,
  stripePaymentIntentId: string | null,
  abandonedCutoff: string,
  createdAt: string,
): "paid" | "pending" | "unpaid" | "abandoned" | "deleted" {
  if (deletedAt) return "deleted";
  if (paidAt) return "paid";
  if (paymentConfirmedAt) return "pending";
  if (stripePaymentIntentId && createdAt < abandonedCutoff) return "abandoned";
  return "unpaid";
}
