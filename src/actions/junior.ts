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

const JUNIOR_FIRST_CHILD_PENCE = 5000; // £50
const JUNIOR_ADDITIONAL_CHILD_PENCE = 3000; // £30

const priceForChild = (existingCount: number, newIndex: number) =>
  existingCount + newIndex === 0
    ? JUNIOR_FIRST_CHILD_PENCE
    : JUNIOR_ADDITIONAL_CHILD_PENCE;

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

    // Count existing dependents registered this calendar year for pricing
    const existingCount = await client
      .selectFrom("dependent")
      .where("member_id", "=", member.id)
      .where("created_at", ">=", currentYearStart())
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();

    // Create dependent rows
    const dependentIds: string[] = [];
    const names: string[] = [];

    for (const dep of dependents) {
      const id = randomUUID();
      dependentIds.push(id);
      names.push(dep.name);

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

    // Calculate total charge amount
    let totalPence = 0;
    for (let i = 0; i < dependents.length; i++) {
      totalPence += priceForChild(existingCount.count, i);
    }

    // Create charge on the parent
    const year = new Date().getFullYear();
    const chargeId = randomUUID();

    await client
      .insertInto("charge")
      .values({
        id: chargeId,
        member_id: member.id,
        description: `Junior Membership (${names.join(", ")}) ${year}`,
        amount_pence: totalPence,
        charge_date: new Date().toISOString().slice(0, 10),
        created_by: user.id,
      })
      .executeTakeFirst();

    // Link charge to dependents
    for (const depId of dependentIds) {
      await client
        .insertInto("charge_dependent")
        .values({
          charge_id: chargeId,
          dependent_id: depId,
        })
        .executeTakeFirst();
    }

    return { dependentIds, memberId: member.id, chargeId };
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
      return { dependents: [], currentYearCount: 0 };
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
