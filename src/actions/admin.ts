import { defineAuthAction } from "@/lib/auth/api";
import { auth } from "@/lib/auth/server";
import { client } from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { stripeDate } from "@/lib/util/stripeDate";
import { ActionError } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "crypto";

async function fetchStripeCharges(email: string): Promise<
  {
    id: string;
    created: string;
    amount: number;
    description: string | null;
  }[]
> {
  try {
    const customers = await stripe.customers.search({
      query: `email:"${email}"`,
    });

    const customer = customers.data[0];

    if (customers.data.length !== 1 || !customer) {
      return [];
    }

    const stripeCharges = await stripe.charges.search({
      query: `customer:"${customer.id}"`,
    });

    return stripeCharges.data.map((charge) => ({
      id: charge.id,
      created: stripeDate(charge.created).toISOString(),
      amount: charge.amount,
      description: charge.description,
    }));
  } catch (err) {
    console.error("Failed to fetch Stripe charges for", email, err);
    return [];
  }
}

export const admin = {
  listUsers: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      search: z.string().optional(),
    }),
    handler: async ({ page, pageSize, search }, session) => {
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
    handler: async ({ userId }, session) => {
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

      const charges = await fetchStripeCharges(user.email);

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
        charges,
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
      chargeDate: z.string(),
    }),
    handler: async ({ memberId, description, amountPence, chargeDate }, session) => {
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
        })
        .execute();

      const charge = await client
        .selectFrom("charge")
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirstOrThrow();

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
      const charge = await client
        .selectFrom("charge")
        .where("id", "=", chargeId)
        .selectAll()
        .executeTakeFirst();

      if (!charge) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Charge not found",
        });
      }

      if (charge.paid_at) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Cannot delete a charge that has already been paid",
        });
      }

      await client
        .updateTable("charge")
        .set({
          deleted_at: new Date().toISOString(),
          deleted_by: session.user.id,
          deleted_reason: reason,
        })
        .where("id", "=", chargeId)
        .execute();

      return { success: true };
    },
  }),
};
