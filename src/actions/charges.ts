import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { ActionError } from "astro:actions";
import { z } from "astro:schema";

export const charges = {
  getMyCharges: defineAuthAction({
    input: z.object({}),
    handler: async (_, session) => {
      const member = await client
        .selectFrom("member")
        .where("email", "=", session.user.email)
        .select(["id"])
        .executeTakeFirst();

      if (!member) {
        return { charges: [] };
      }

      const charges = await client
        .selectFrom("charge")
        .where("member_id", "=", member.id)
        .where("deleted_at", "is", null)
        .selectAll()
        .orderBy("charge_date", "desc")
        .execute();

      return { charges };
    },
  }),

  payOutstandingBalance: defineAuthAction({
    input: z.object({}),
    handler: async (_, session) => {
      const member = await client
        .selectFrom("member")
        .where("email", "=", session.user.email)
        .select(["id"])
        .executeTakeFirst();

      if (!member) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "No member record found for your account",
        });
      }

      const unpaidCharges = await client
        .selectFrom("charge")
        .where("member_id", "=", member.id)
        .where("paid_at", "is", null)
        .where("deleted_at", "is", null)
        .selectAll()
        .execute();

      if (unpaidCharges.length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "No outstanding charges to pay",
        });
      }

      const totalAmountPence = unpaidCharges.reduce(
        (sum, c) => sum + c.amount_pence,
        0,
      );

      const chargeIds = unpaidCharges.map((c) => c.id);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountPence,
        currency: "gbp",
        metadata: {
          type: "charges",
          memberEmail: session.user.email,
          chargeIds: chargeIds.join(","),
        },
      });

      if (!paymentIntent.client_secret) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create payment intent",
        });
      }

      return {
        clientSecret: paymentIntent.client_secret,
        totalAmountPence,
        chargeIds,
      };
    },
  }),
};
