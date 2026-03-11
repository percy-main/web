import * as playCricketApi from "@/lib/play-cricket";
import type { LiveLoader } from "astro/loaders";
import _ from "lodash";

export interface LeagueTableData {
  [key: string]: unknown;
  id: string | number;
  name: string;
  columns: string[];
  rows: Array<{ position: string; team_id: string } & Record<string, string>>;
}

interface EntryFilter {
  id: string;
}

/** Simple in-memory cache with TTL */
const cache = new Map<string, { data: LeagueTableData; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchLeagueTable(
  divisionId: string,
): Promise<LeagueTableData> {
  const now = Date.now();
  const cached = cache.get(divisionId);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const {
    league_table: [league_table],
  } = await playCricketApi.getLeagueTable({ divisionId });

  const columns = Object.values(league_table.headings);

  const rows = league_table.values.map(
    ({ position, team_id, ...team }) =>
      ({
        position,
        team_id,
        ...Object.fromEntries(_.zip(columns, Object.values(team))),
      }) as { position: string; team_id: string } & Record<string, string>,
  );

  const data: LeagueTableData = {
    id: league_table.id,
    name: league_table.name,
    columns,
    rows,
  };

  cache.set(divisionId, { data, fetchedAt: now });

  return data;
}

export const loader: LiveLoader<LeagueTableData, EntryFilter> = {
  name: "league-table",
  loadCollection: () => {
    // Not used — league tables are always loaded per-entry via getLiveEntry
    return Promise.resolve({ entries: [] });
  },
  loadEntry: async ({ filter }) => {
    const divisionId = filter.id;
    const data = await fetchLeagueTable(divisionId);

    return {
      id: divisionId,
      data,
    };
  },
};
