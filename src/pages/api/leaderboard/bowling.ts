export const prerender = false;

import { client } from "@/lib/db/client";
import type { BowlingEntry } from "@/lib/leaderboard-schemas";
import type { APIContext } from "astro";
import { sql } from "kysely";

const MAX_LIMIT = 50;
const CACHE_MAX_AGE = 43200; // 12 hours
const CACHE_SWR = 86400; // 24 hours stale-while-revalidate

export async function GET({ url }: APIContext): Promise<Response> {
  const season = Number(url.searchParams.get("season"));
  if (!season || !Number.isInteger(season)) {
    return new Response(JSON.stringify({ error: "season is required" }), {
      status: 400,
    });
  }

  const teamId = url.searchParams.get("teamId") ?? undefined;
  const competitionTypesParam = url.searchParams.get("competitionTypes");
  const competitionTypes = competitionTypesParam
    ? competitionTypesParam.split(",")
    : undefined;
  const isJunior = url.searchParams.get("isJunior") === "true";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || MAX_LIMIT, 1),
    MAX_LIMIT,
  );

  let innerQuery = client
    .selectFrom("match_performance_bowling as b")
    .innerJoin("play_cricket_team as t", "t.id", "b.team_id")
    .select([
      "b.player_id",
      "b.player_name",
      sql<number>`COUNT(*)`.as("matches"),
      sql<number>`SUM(b.wickets)`.as("total_wickets"),
      sql<number>`SUM(b.runs)`.as("total_runs"),
      sql<number>`SUM(b.maidens)`.as("total_maidens"),
      sql<number>`SUM(b.wides)`.as("total_wides"),
      sql<number>`SUM(b.no_balls)`.as("total_no_balls"),
      sql<number>`MAX(b.wickets)`.as("best_wickets"),
      sql<number>`SUM(
        CASE WHEN INSTR(b.overs, '.') > 0
          THEN CAST(b.overs AS INTEGER) * 6 + CAST(SUBSTR(b.overs, INSTR(b.overs, '.') + 1) AS INTEGER)
          ELSE CAST(b.overs AS INTEGER) * 6
        END
      )`.as("total_balls"),
    ])
    .where("b.season", "=", season)
    .where("t.is_junior", "=", isJunior ? 1 : 0)
    .groupBy(["b.player_id", "b.player_name"])
    .orderBy("total_wickets", "desc")
    .limit(limit);

  if (teamId) {
    innerQuery = innerQuery.where("b.team_id", "=", teamId);
  }

  if (competitionTypes && competitionTypes.length > 0) {
    innerQuery = innerQuery.where(
      "b.competition_type",
      "in",
      competitionTypes,
    );
  }

  const rows = await client
    .selectFrom(innerQuery.as("r"))
    .leftJoin("member as m", (join) =>
      join
        .onRef("m.play_cricket_id", "=", "r.player_id")
        .on("m.contentful_entry_id", "is not", null),
    )
    .select([
      "r.player_id",
      "r.player_name",
      "r.matches",
      "r.total_wickets",
      "r.total_runs",
      "r.total_maidens",
      "r.total_wides",
      "r.total_no_balls",
      "r.best_wickets",
      "r.total_balls",
      "m.contentful_entry_id",
    ])
    .execute();

  const entries: BowlingEntry[] = rows.map((r) => {
    const totalOvers = Math.floor(r.total_balls / 6);
    const remainingBalls = r.total_balls % 6;
    const oversStr = `${totalOvers}.${remainingBalls}`;

    const average =
      r.total_wickets > 0 ? r.total_runs / r.total_wickets : null;
    const economy =
      r.total_balls > 0 ? r.total_runs / (r.total_balls / 6) : null;
    const strikeRate =
      r.total_wickets > 0 ? r.total_balls / r.total_wickets : null;

    return {
      playerId: r.player_id,
      playerName: r.player_name,
      contentfulEntryId: r.contentful_entry_id ?? null,
      matches: r.matches,
      overs: oversStr,
      maidens: r.total_maidens,
      runs: r.total_runs,
      wickets: r.total_wickets,
      average:
        average !== null && r.total_balls >= 60
          ? Math.round(average * 100) / 100
          : null,
      economy:
        economy !== null ? Math.round(economy * 100) / 100 : null,
      strikeRate:
        strikeRate !== null && r.total_balls >= 60
          ? Math.round(strikeRate * 10) / 10
          : null,
      bestWickets: r.best_wickets,
    };
  });

  return new Response(JSON.stringify({ entries }), {
    headers: {
      "Content-Type": "application/json",
      "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_SWR}`,
      "Netlify-Cache-Tag": "leaderboard",
      "Netlify-Cache-ID": "leaderboard",
      "Netlify-Vary": "query",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
