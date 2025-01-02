import { z, defineCollection } from "astro:content";
import { client } from "../lib/contentful/client";
import type { EntrySkeletonType } from "contentful";
import type { TypePage, TypePageSkeleton } from "../__generated__";

const pageSchema = z.object({
  title: z.string(),
  content: z.any(),
  slug: z.string(),
});

export type Page = z.TypeOf<typeof pageSchema>;

export const page = defineCollection({
  loader: async () => {
    const response = await client.getEntries<TypePageSkeleton>({
      content_type: "page",
      "metadata.tags.sys.id[nin]": ["sport"],
    });

    return response.items.map((item) => ({
      id: item.sys.id,
      title: item.fields.title,
      content: item.fields.content,
      slug: item.fields.slug,
    }));
  },
  schema: pageSchema,
});
