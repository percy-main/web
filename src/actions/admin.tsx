import { defineAuthAction } from "@/lib/auth/api";
import { auth } from "@/lib/auth/server";
import { client } from "@/lib/db/client";
import { send } from "@/lib/email/send";
import { getAgeGroup, getTeamName } from "@/lib/util/ageGroup";
import { render } from "@react-email/render";
import { ActionError } from "astro:actions";
import { BASE_URL } from "astro:env/client";
import { z } from "astro:schema";
import { randomUUID } from "crypto";
import { formatDate } from "date-fns";
import { ChargeNotification } from "~/emails/ChargeNotification";

export const admin = {
  listUsers: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      search: z.string().optional(),
    }),
    handler: async ({ page, pageSize, search }) => {
      let baseQuery = client
        .selectFrom("user")
        .leftJoin("member", "member.email", "user.email")
        .leftJoin("membership", "membership.member_id", "member.id");

      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb("user.name", "like", term),
            eb("user.email", "like", term),
          ]),
        );
      }

      const countResult = await baseQuery
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirstOrThrow();

      const total = Number(countResult.total);

      const offset = (page - 1) * pageSize;

      const users = await (() => {
        let q = client
          .selectFrom("user")
          .leftJoin("member", "member.email", "user.email")
          .leftJoin("membership", "membership.member_id", "member.id");

        if (search && search.trim().length > 0) {
          const term = `%${search.trim()}%`;
          q = q.where((eb) =>
            eb.or([
              eb("user.name", "like", term),
              eb("user.email", "like", term),
            ]),
          );
        }

        return q
          .select([
            "user.id",
            "user.name",
            "user.email",
            "user.role",
            "user.createdAt",
            "member.id as memberId",
            "membership.type as membershipType",
            "membership.paid_until as paidUntil",
          ])
          .orderBy("user.createdAt", "desc")
          .limit(pageSize)
          .offset(offset)
          .execute();
      })();

      return {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          isMember: u.memberId !== null,
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
        },
        member: member ?? null,
        membership,
        dependents,
      };
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
    handler: async ({ userId, role }, session, context) => {
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
            name={member.name}
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
    handler: async () => {
      const rows = await client
        .selectFrom("dependent")
        .innerJoin("member", "member.id", "dependent.member_id")
        .leftJoin("membership", (join) =>
          join
            .onRef("membership.dependent_id", "=", "dependent.id")
            .on("membership.type", "=", "junior"),
        )
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
        ])
        .orderBy("dependent.name", "asc")
        .execute();

      return rows.map((row) => ({
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
      }));
    },
  }),
};
