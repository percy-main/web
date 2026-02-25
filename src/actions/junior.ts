import { stripe } from "@/lib/payments/client";
import { defineAuthAction } from "../lib/auth/api";
import { client } from "../lib/db/client";
import { ActionError } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "crypto";
import { differenceInYears } from "date-fns";

/** Only dependents registered in the current calendar year count towards the family discount. */
const currentYearStart = () =>
  new Date(Date.UTC(new Date().getFullYear(), 0, 1)).toISOString();

const dependentSchema = z.object({
  name: z.string().min(1),
  sex: z.string().min(1),
  dob: z.string().min(1),
});

const JUNIOR_FIRST_CHILD_PRICE = 5000; // £50 in pence
const JUNIOR_ADDITIONAL_CHILD_PRICE = 3000; // £30 in pence

export const addDependents = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    dependents: z.array(dependentSchema).min(1),
  }),
  handler: async ({ dependents }, { user }) => {
    const member = await client
      .selectFrom("member")
      .select(["id"])
      .where("email", "=", user.email)
      .executeTakeFirst();

    if (!member) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message:
          "You must complete your member registration before adding dependents.",
      });
    }

    for (const dep of dependents) {
      const age = differenceInYears(new Date(), new Date(dep.dob));
      if (age >= 18) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `${dep.name} must be under 18 to register as a junior member.`,
        });
      }
      if (age < 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Invalid date of birth for ${dep.name}.`,
        });
      }
    }

    const existingCount = await client
      .selectFrom("dependent")
      .where("member_id", "=", member.id)
      .where("created_at", ">=", currentYearStart())
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    const ids: string[] = [];

    for (const dep of dependents) {
      const id = randomUUID();
      ids.push(id);

      await client
        .insertInto("dependent")
        .values({
          id,
          member_id: member.id,
          name: dep.name,
          sex: dep.sex,
          dob: dep.dob,
        })
        .executeTakeFirst();
    }

    return {
      dependentIds: ids,
      memberId: member.id,
      existingDependentCount: existingCount.count,
    };
  },
});

export const juniorCheckout = defineAuthAction({
  requireVerifiedEmail: true,
  input: z.object({
    dependentIds: z.array(z.string()).min(1),
    memberId: z.string(),
  }),
  handler: async ({ dependentIds, memberId }, { user }) => {
    const member = await client
      .selectFrom("member")
      .select(["id"])
      .where("email", "=", user.email)
      .where("id", "=", memberId)
      .executeTakeFirst();

    if (!member) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "Member not found.",
      });
    }

    const dependents = await client
      .selectFrom("dependent")
      .select(["id", "name"])
      .where("member_id", "=", memberId)
      .where("id", "in", dependentIds)
      .execute();

    if (dependents.length !== dependentIds.length) {
      throw new ActionError({
        code: "BAD_REQUEST",
        message: "One or more dependents not found.",
      });
    }

    // Only dependents registered this calendar year count towards the
    // family discount — previous years' registrations don't carry over.
    const existingCount = await client
      .selectFrom("dependent")
      .where("member_id", "=", memberId)
      .where("id", "not in", dependentIds)
      .where("created_at", ">=", currentYearStart())
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    const lineItems = dependents.map((dep, i) => ({
      price_data: {
        currency: "gbp" as const,
        unit_amount:
          existingCount.count + i === 0
            ? JUNIOR_FIRST_CHILD_PRICE
            : JUNIOR_ADDITIONAL_CHILD_PRICE,
        product_data: {
          name: `Junior Membership - ${dep.name}`,
        },
      },
      quantity: 1,
    }));

    try {
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "payment",
        line_items: lineItems,
        redirect_on_completion: "never",
        metadata: {
          type: "junior_membership",
          member_id: memberId,
          dependent_ids: dependentIds.join(","),
        },
        customer_email: user.email,
      });

      if (!session.client_secret) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not generate checkout",
        });
      }

      return { clientSecret: session.client_secret };
    } catch (err) {
      console.error(err);
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not generate checkout",
      });
    }
  },
});

export const dependents = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    const member = await client
      .selectFrom("member")
      .select(["id"])
      .where("email", "=", user.email)
      .executeTakeFirst();

    if (!member) {
      return { dependents: [] };
    }

    const deps = await client
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
        "dependent.created_at",
        "membership.paid_until",
        "membership.id as membership_id",
      ])
      .where("dependent.member_id", "=", member.id)
      .execute();

    const currentYearCount = deps.filter(
      (d) => d.created_at >= currentYearStart(),
    ).length;

    return { dependents: deps, currentYearCount };
  },
});
