import { z, defineCollection } from "astro:content";
import { client } from "../lib/contentful/client";
import type { EntrySkeletonType } from "contentful";
import type { TypePageSkeleton } from "../__generated__";

const sportSchema = z.object({
  title: z.string(),
  content: z.any(),
  slug: z.string(),
});

export type Sport = z.TypeOf<typeof sportSchema>;

export const sport = defineCollection({
  loader: async () => {
    const response = await client.getEntries<TypePageSkeleton>({
      content_type: "page",
      "metadata.tags.sys.id[all]": ["sport"],
      include: 10,
    });

    return response.items.map((item) => ({
      id: item.sys.id,
      title: item.fields.title,
      content: item.fields.content,
      slug: item.fields.slug,
    }));
  },
  schema: sportSchema,
});
