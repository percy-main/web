import { z, defineCollection } from "astro:content";
import { contentClient } from "@/lib/contentful/client";
import { type TypeNewsSkeleton, type TypePageSkeleton } from "@/__generated__";
import type { Entry } from "contentful";

const slugup = (page: Entry<TypePageSkeleton, undefined, string>): string => {
  if (!page.fields.parent || !("fields" in page.fields.parent)) {
    return `${page.fields.slug}`;
  }

  return `${slugup(page.fields.parent)}/${page.fields.slug}`;
};

const newsSchema = z.object({
  title: z.string(),
  content: z.any(),
  summary: z.any(),
  when: z.date(),
  pages: z.array(
    z.object({ id: z.string(), slug: z.string(), title: z.string() }),
  ),
});

export type News = z.TypeOf<typeof newsSchema>;

export const news = defineCollection({
  loader: async () => {
    const response = await contentClient.getEntries<TypeNewsSkeleton>({
      content_type: "news",
    });

    return response.items.map((item) => ({
      id: item.sys.id,
      title: item.fields.title,
      content: item.fields.content,
      summary: item.fields.summary,
      when: new Date(item.sys.createdAt),
      pages:
        item.fields.pages?.map((page) => {
          if ("fields" in page)
            return {
              id: page.sys.id,
              slug: `/${slugup(page)}`,
              title: page.fields.title,
            };
        }) ?? [],
    }));
  },
  schema: newsSchema,
});
