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
  // Basic info
  name: z.string().min(1),
  sex: z.string().min(1),
  dob: z.string().min(1),
  school_year: z.string().min(1),

  // Cricket experience
  played_before: z.boolean(),
  previous_cricket: z.string().optional(),

  // Contact preferences
  whatsapp_consent: z.boolean(),
  alt_contact_name: z.string().min(1),
  alt_contact_phone: z.string().min(1),
  alt_contact_whatsapp_consent: z.boolean(),

  // Medical
  gp_surgery: z.string().min(1),
  gp_phone: z.string().min(1),
  has_disability: z.boolean(),
  disability_type: z.string().optional(),
  medical_info: z.string().optional(),
  emergency_medical_consent: z.boolean(),
  medical_fitness_declaration: z.boolean(),

  // Consents
  data_protection_consent: z.boolean(),
  photo_consent: z.boolean(),
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

      if (!dep.emergency_medical_consent) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Emergency medical consent is required for ${dep.name}.`,
        });
      }

      if (!dep.medical_fitness_declaration) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Medical fitness declaration is required for ${dep.name}.`,
        });
      }

      if (!dep.data_protection_consent) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Data protection consent is required for ${dep.name}.`,
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
          school_year: dep.school_year,
          played_before: dep.played_before ? 1 : 0,
          previous_cricket: dep.previous_cricket ?? null,
          whatsapp_consent: dep.whatsapp_consent ? 1 : 0,
          alt_contact_name: dep.alt_contact_name,
          alt_contact_phone: dep.alt_contact_phone,
          alt_contact_whatsapp_consent: dep.alt_contact_whatsapp_consent
            ? 1
            : 0,
          gp_surgery: dep.gp_surgery,
          gp_phone: dep.gp_phone,
          has_disability: dep.has_disability ? 1 : 0,
          disability_type: dep.disability_type ?? null,
          medical_info: dep.medical_info ?? null,
          emergency_medical_consent: dep.emergency_medical_consent ? 1 : 0,
          medical_fitness_declaration: dep.medical_fitness_declaration ? 1 : 0,
          data_protection_consent: dep.data_protection_consent ? 1 : 0,
          photo_consent: dep.photo_consent ? 1 : 0,
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
        "dependent.school_year",
        "dependent.photo_consent",
        "dependent.medical_info",
        "dependent.has_disability",
        "dependent.disability_type",
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
