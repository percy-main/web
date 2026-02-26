import * as db from "@/lib/db/client";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "crypto";

const input = z.object({
  title: z.string(),
  name: z.string(),
  address: z.string(),
  postcode: z.string(),
  dob: z.string(),
  telephone: z.string(),
  email: z.string(),
  emerg_name: z.string(),
  emerg_phone: z.string(),
});

export const handler = async (data: z.TypeOf<typeof input>) => {
  const existing = await db.client
    .selectFrom("member")
    .where("email", "=", data.email)
    .select("id")
    .executeTakeFirst();

  if (existing) {
    await db.client
      .updateTable("member")
      .set({
        title: data.title,
        name: data.name,
        address: data.address,
        postcode: data.postcode,
        dob: data.dob,
        telephone: data.telephone,
        emergency_contact_name: data.emerg_name,
        emergency_contact_telephone: data.emerg_phone,
      })
      .where("id", "=", existing.id)
      .execute();

    return { id: existing.id, ...data };
  }

  const id = randomUUID();

  await db.client
    .insertInto("member")
    .values({
      id,
      title: data.title,
      name: data.name,
      address: data.address,
      postcode: data.postcode,
      dob: data.dob,
      telephone: data.telephone,
      email: data.email,
      emergency_contact_name: data.emerg_name,
      emergency_contact_telephone: data.emerg_phone,
    })
    .executeTakeFirst();

  return { id, ...data };
};

export const join = defineAction({
  accept: "form",
  input,
  handler,
});
