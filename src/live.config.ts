import { loader as personStatsLoader } from "@/collections/person-stats";
import { defineLiveCollection } from "astro:content";

const personStats = defineLiveCollection({ loader: personStatsLoader });

export const collections = { personStats };
