import { z, defineCollection } from "astro:content";
import { client } from "../lib/contentful/client";
import type { TypeNewsSkeleton } from "../__generated__";
import * as df from "date-fns";

const newsSchema = z.object({
  title: z.string(),
  content: z.any(),
  summary: z.any(),
  when: z.string(),
});

export type News = z.TypeOf<typeof newsSchema>;

export const news = defineCollection({
  loader: async () => {
    const response = await client.getEntries<TypeNewsSkeleton>({
      content_type: "news",
    });

    return response.items.map((item) => ({
      id: item.sys.id,
      title: item.fields.title,
      content: item.fields.content,
      summary: item.fields.summary,
      when: df.format(new Date(item.sys.createdAt), "PPPP"),
    }));
  },
  schema: newsSchema,
});
