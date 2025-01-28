import { contentClient } from "@/lib/contentful/client";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";
import type { Asset, AssetDetails } from "contentful";
import type { TypeTrusteeSkeleton } from "../__generated__";

export const schema = z.object({
  name: z.string(),
  bio: z.any().optional(),
  photo: z
    .object({
      url: z.string(),
      title: z.string(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  slug: z.string(),
  pageData: z.object({}).passthrough(),
  isDBSChecked: z.boolean(),
});

export type Person = z.TypeOf<typeof schema>;

export const loader = async () => {
  const response = await contentClient.getEntries<TypeTrusteeSkeleton>({
    content_type: "trustee",
  });

  return response.items.map((item) => {
    const photo = item.fields.photo as Asset | undefined;
    const photoDetails =
      photo && (photo.fields.file!.details as AssetDetails | undefined);
    return {
      id: item.sys.id,
      name: item.fields.name,
      bio: item.fields.bio,
      photo: photo && {
        url: photo.fields.file!.url,
        title: photo.fields.title ?? item.fields.name,
        width: photoDetails!.image!.height,
        height: photoDetails!.image!.width,
      },
      slug: item.fields.slug,
      pageData: item.fields.pageData ?? {},
      isDBSChecked: item.fields.dbsChecked ?? false,
    };
  });
};

export const person = defineCollection({
  schema,
  loader,
});
