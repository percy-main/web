import * as db from "@/lib/db/client";
import { sendMessage } from "@/lib/slack/sendMessage";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "crypto";

const input = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
  page: z.string().min(1).max(500),
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

  try {
    await sendMessage(
      `New contact form submission from ${name} (${email}) on ${page}:\n${message}`,
    );
  } catch {
    // Slack notification failed, but submission was saved successfully
  }

  return { id };
};

export const createContactSubmission = defineAction({
  input,
  handler,
});
