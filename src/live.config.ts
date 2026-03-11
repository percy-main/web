import { loader as leagueTableLoader } from "@/collections/league-table";
import { loader as personStatsLoader } from "@/collections/person-stats";
import { defineLiveCollection } from "astro:content";

const leagueTable = defineLiveCollection({ loader: leagueTableLoader });
const personStats = defineLiveCollection({ loader: personStatsLoader });

export const collections = { leagueTable, personStats };
