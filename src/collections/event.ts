import { z, defineCollection } from "astro:content";
import { contentClient } from "@/lib/contentful/client";
import { type TypeEventSkeleton } from "@/__generated__";
import * as df from "date-fns";
import * as location from "@/collections/location";
import { fromFields } from "@/lib/contentful/from-fields";

export const schema = z.object({
  name: z.string(),
  description: z.any(),
  when: z.date(),
  finish: z.date().optional(),
  location: location.schema.optional(),
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
      location: item.fields.location
        ? location.schema.parse(fromFields(item.fields.location))
        : undefined,
    };
  });
};

export const event = defineCollection({
  loader,
  schema,
});
