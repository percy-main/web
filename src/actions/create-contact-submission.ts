import * as db from "@/lib/db/client";
import { sendMessage } from "@/lib/slack/sendMessage";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "crypto";

const input = z.object({
  name: z.string(),
  email: z.string().email(),
  message: z.string(),
  page: z.string(),
});

export const handler = async ({
  name,
  email,
  message,
  page,
}: z.TypeOf<typeof input>) => {
  const id = randomUUID();

  await db.client
    .insertInto("contact_submission")
    .values({
      id,
      name,
      email,
      message,
      page,
    })
    .executeTakeFirst();

  await sendMessage(
    `New contact form submission from ${name} (${email}) on ${page}:\n${message}`,
  );

  return { id };
};

export const createContactSubmission = defineAction({
  input,
  handler,
});
