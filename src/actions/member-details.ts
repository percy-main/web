import { defineAuthAction } from "../lib/auth/api";
import { client } from "../lib/db/client";
import { z } from "astro/zod";
import { randomUUID } from "crypto";

export const getMemberDetails = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    const member = await client
      .selectFrom("member")
      .where("email", "=", user.email)
      .where("deleted_at", "is", null)
      .select([
        "title",
        "name",
        "address",
        "postcode",
        "dob",
        "telephone",
        "email",
        "emergency_contact_name",
        "emergency_contact_telephone",
      ])
      .executeTakeFirst();

    return { member: member ?? null, userName: user.name };
  },
});

const updateInput = z.object({
  title: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  postcode: z.string().min(1).optional(),
  dob: z.string().min(1).optional(),
  telephone: z.string().min(1).optional(),
  emergency_contact_name: z.string().min(1).optional(),
  emergency_contact_telephone: z.string().min(1).optional(),
});

export const updateMemberDetails = defineAuthAction({
  requireVerifiedEmail: true,
  input: updateInput,
  handler: async (data, { user }) => {
    // Build set object only from provided fields
    const fields: Record<string, string | undefined> = {
      title: data.title,
      name: data.name,
      address: data.address,
      postcode: data.postcode,
      dob: data.dob,
      telephone: data.telephone,
      emergency_contact_name: data.emergency_contact_name,
      emergency_contact_telephone: data.emergency_contact_telephone,
    };
    const setValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setValues[key] = value;
      }
    }

    const existing = await client
      .selectFrom("member")
      .where("email", "=", user.email)
      .where("deleted_at", "is", null)
      .select("id")
      .executeTakeFirst();

    if (existing) {
      if (Object.keys(setValues).length > 0) {
        await client
          .updateTable("member")
          .set(setValues)
          .where("id", "=", existing.id)
          .execute();
      }
    } else {
      await client
        .insertInto("member")
        .values({
          id: randomUUID(),
          email: user.email,
          ...setValues,
        })
        .execute();
    }

    return { success: true };
  },
});
