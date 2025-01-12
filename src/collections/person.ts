import { z } from "astro/zod";

export const schema = z.object({
  name: z.string(),
  profile: z.string().optional(),
  photo: z
    .object({
      url: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),
});

export type Person = z.TypeOf<typeof schema>;
