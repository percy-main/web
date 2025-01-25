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
  author: z.object({
    id: z.string(),
    name: z.string(),
    photo: z
      .object({
        url: z.string(),
        title: z.string(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    slug: z.string(),
  }),
});

export type News = z.TypeOf<typeof newsSchema>;

export const news = defineCollection({
  loader: async () => {
    const response = await contentClient.getEntries<TypeNewsSkeleton>({
      content_type: "news",
    });

    return response.items.map((item) => {
      const author =
        item.fields.author && "fields" in item.fields.author
          ? {
              id: item.fields.author.sys.id,
              name: item.fields.author.fields.name,
              slug: item.fields.author.fields.slug,
              photo:
                item.fields.author.fields.photo &&
                "fields" in item.fields.author.fields.photo &&
                item.fields.author.fields.photo.fields.file &&
                "details" in item.fields.author.fields.photo.fields.file &&
                item.fields.author.fields.photo.fields.file.details.image
                  ? {
                      url: item.fields.author.fields.photo.fields.file.url,
                      title: item.fields.author.fields.photo.fields.title,
                      width:
                        item.fields.author.fields.photo.fields.file.details
                          .image.width,
                      height:
                        item.fields.author.fields.photo.fields.file.details
                          .image.height,
                    }
                  : undefined,
            }
          : undefined;
      return {
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
        author,
      };
    });
  },
  schema: newsSchema,
});
