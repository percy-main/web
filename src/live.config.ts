import { defineLiveCollection } from "astro:content";
import { personStatsLoader } from "@/collections/person-stats-loader";

const personStats = defineLiveCollection({
  loader: personStatsLoader(),
});

export const collections = { personStats };
