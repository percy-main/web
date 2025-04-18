import * as db from "@/lib/db/client";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "crypto";

const input = z.object({
  meta: z.object({}).passthrough(),
  email: z.string(),
});

export const handler = async ({ meta, email }: z.TypeOf<typeof input>) => {
  const id = randomUUID();

  await db.client
    .insertInto("event_subscriber")
    .values({
      id,
      meta: JSON.stringify(meta),
      email,
    })
    .executeTakeFirst();

  return { id };
};

export const createEventSubscriber = defineAction({
  input,
  handler,
});
