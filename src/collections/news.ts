import { type TypeNewsSkeleton } from "@/__generated__";
import { contentClient } from "@/lib/contentful/client";
import { slugup, type Sluggable } from "@/lib/util/slug";
import { defineCollection, z } from "astro:content";

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
  slug: z.string(),
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
                slug: `/${slugup(page as Sluggable)}`,
                title: page.fields.title,
              };
          }) ?? [],
        author,
        slug: item.fields.slug,
      };
    });
  },
  schema: newsSchema,
});
