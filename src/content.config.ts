import { defineCollection, z } from "astro:content";
import { CDN_SPACE_ID, CDN_TOKEN } from "astro:env/server";
import * as contentful from "contentful";

const client = contentful.createClient({
  space: CDN_SPACE_ID,
  accessToken: CDN_TOKEN,
});

const pageSchema = z.object({
  title: z.string(),
  content: z.any(),
  slug: z.string(),
});

export type Page = z.TypeOf<typeof pageSchema>;

const sport = defineCollection({
  loader: async () => {
    const response = await client.getEntries<
      contentful.EntrySkeletonType<Page>
    >({
      content_type: "page",
      "metadata.tags.sys.id[all]": ["sport"],
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

const page = defineCollection({
  loader: async () => {
    const response = await client.getEntries<
      contentful.EntrySkeletonType<Page>
    >({
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

export const collections = { sport, page };
