import { defineAuthAction } from "../lib/auth/api";
import { client } from "../lib/db/client";
import { z } from "astro:schema";
import { randomUUID } from "crypto";

export const getMemberDetails = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    const member = await client
      .selectFrom("member")
      .where("email", "=", user.email)
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

    return { member: member ?? null };
  },
});

const updateInput = z.object({
  title: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  postcode: z.string().min(1),
  dob: z.string().min(1),
  telephone: z.string().min(1),
  emergency_contact_name: z.string().min(1),
  emergency_contact_telephone: z.string().min(1),
});

export const updateMemberDetails = defineAuthAction({
  requireVerifiedEmail: true,
  input: updateInput,
  handler: async (data, { user }) => {
    const existing = await client
      .selectFrom("member")
      .where("email", "=", user.email)
      .select("id")
      .executeTakeFirst();

    if (existing) {
      await client
        .updateTable("member")
        .set({
          title: data.title,
          name: data.name,
          address: data.address,
          postcode: data.postcode,
          dob: data.dob,
          telephone: data.telephone,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_telephone: data.emergency_contact_telephone,
        })
        .where("id", "=", existing.id)
        .execute();
    } else {
      await client
        .insertInto("member")
        .values({
          id: randomUUID(),
          title: data.title,
          name: data.name,
          address: data.address,
          postcode: data.postcode,
          dob: data.dob,
          telephone: data.telephone,
          email: user.email,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_telephone: data.emergency_contact_telephone,
        })
        .execute();
    }

    return { success: true };
  },
});
