import { z, defineCollection } from "astro:content";
import { contentClient } from "@/lib/contentful/client";
import { type TypeEventSkeleton } from "@/__generated__";
import * as df from "date-fns";

export const schema = z.object({
  name: z.string(),
  description: z.any(),
  when: z.date(),
});

export type Event = z.TypeOf<typeof schema>;

export const loader = async () => {
  const response = await contentClient.getEntries<TypeEventSkeleton>({
    content_type: "event",
  });

  return response.items.map((item) => {
    return {
      id: item.sys.id,
      name: item.fields.name,
      description: item.fields.description,
      when: df.parseISO(item.fields.when),
    };
  });
};

export const event = defineCollection({
  loader,
  schema,
});
