import { z, defineCollection } from "astro:content";
import { contentClient } from "@/lib/contentful/client";
import type { Entry } from "contentful";
import { type TypePageSkeleton } from "@/__generated__";

const pageSchema = z.object({
  title: z.string(),
  content: z.any(),
  slug: z.string(),
  isMainMenu: z.boolean(),
  parent: z
    .object({
      title: z.string(),
      slug: z.string(),
    })
    .optional(),
  menuOrder: z.number().optional(),
});

export type Page = z.TypeOf<typeof pageSchema>;

export const page = defineCollection({
  loader: async () => {
    const response = await contentClient.getEntries<TypePageSkeleton>({
      content_type: "page",
    });

    return response.items.map((item) => {
      return {
        id: item.sys.id,
        title: item.fields.title,
        content: item.fields.content,
        slug: item.fields.slug,
        isMainMenu: item.fields.mainMenuItem ?? false,
        parent: item.fields.parent
          ? {
              title: (item.fields.parent as Entry<TypePageSkeleton>).fields
                .title,
              slug: (item.fields.parent as Entry<TypePageSkeleton>).fields.slug,
            }
          : undefined,
        menuOrder: item.fields.menuOrder,
      };
    });
  },
  schema: pageSchema,
});
