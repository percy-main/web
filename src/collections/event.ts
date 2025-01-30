import { type TypeEventSkeleton } from "@/__generated__";
import * as location from "@/collections/location";
import { contentClient } from "@/lib/contentful/client";
import { fromFields } from "@/lib/contentful/from-fields";
import { defineCollection, z } from "astro:content";
import * as df from "date-fns";

export const schema = z.object({
  name: z.string(),
  description: z.any(),
  when: z.date(),
  finish: z.date().optional(),
  location: location.schema.optional(),
  createdAt: z.date(),
});

export type Event = z.TypeOf<typeof schema>;

export const loader = async () => {
  const response = await contentClient.getEntries<TypeEventSkeleton>({
    content_type: "event",
  });

  return response.items.map((item) => {
    if (!item.fields.location || !("fields" in item.fields.location)) {
      throw new Error("Invalid item");
    }
    return {
      id: item.sys.id,
      createdAt: df.parseISO(item.sys.createdAt),
      name: item.fields.name,
      description: item.fields.description,
      when: df.parseISO(item.fields.when),
      finish: item.fields.finish && df.parseISO(item.fields.finish),
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
