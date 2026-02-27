export const prerender = false;

import { client } from "@/lib/db/client";
import type { APIContext } from "astro";
import { sql } from "kysely";
import { z } from "zod";

const MAX_LIMIT = 50;
const CACHE_MAX_AGE = 43200; // 12 hours
const CACHE_SWR = 86400; // 24 hours stale-while-revalidate

export const BattingEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  contentfulEntryId: z.string().nullable(),
  innings: z.number(),
  notOuts: z.number(),
  runs: z.number(),
  highScore: z.number(),
  average: z.number().nullable(),
  strikeRate: z.number().nullable(),
  fours: z.number(),
  sixes: z.number(),
  fifties: z.number(),
  hundreds: z.number(),
});

export const BattingResponseSchema = z.object({
  entries: z.array(BattingEntrySchema),
});

export type BattingEntry = z.infer<typeof BattingEntrySchema>;
export type BattingResponse = z.infer<typeof BattingResponseSchema>;

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
    .selectFrom("match_performance_batting as b")
    .innerJoin("play_cricket_team as t", "t.id", "b.team_id")
    .select([
      "b.player_id",
      "b.player_name",
      sql<number>`SUM(b.runs)`.as("total_runs"),
      sql<number>`COUNT(*)`.as("innings"),
      sql<number>`SUM(b.not_out)`.as("not_outs"),
      sql<number>`MAX(b.runs)`.as("high_score"),
      sql<number>`SUM(b.balls)`.as("total_balls"),
      sql<number>`SUM(b.fours)`.as("total_fours"),
      sql<number>`SUM(b.sixes)`.as("total_sixes"),
      sql<number>`SUM(CASE WHEN b.runs >= 50 AND b.runs < 100 THEN 1 ELSE 0 END)`.as(
        "fifties",
      ),
      sql<number>`SUM(CASE WHEN b.runs >= 100 THEN 1 ELSE 0 END)`.as(
        "hundreds",
      ),
    ])
    .where("b.season", "=", season)
    .where("t.is_junior", "=", isJunior ? 1 : 0)
    .groupBy(["b.player_id", "b.player_name"])
    .orderBy("total_runs", "desc")
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
      "r.total_runs",
      "r.innings",
      "r.not_outs",
      "r.high_score",
      "r.total_balls",
      "r.total_fours",
      "r.total_sixes",
      "r.fifties",
      "r.hundreds",
      "m.contentful_entry_id",
    ])
    .execute();

  const entries: BattingEntry[] = rows.map((r) => {
    const dismissals = r.innings - r.not_outs;
    const average = dismissals > 0 ? r.total_runs / dismissals : null;
    const strikeRate =
      r.total_balls > 0 ? (r.total_runs / r.total_balls) * 100 : null;

    return {
      playerId: r.player_id,
      playerName: r.player_name,
      contentfulEntryId: r.contentful_entry_id ?? null,
      innings: r.innings,
      notOuts: r.not_outs,
      runs: r.total_runs,
      highScore: r.high_score,
      average:
        average !== null && r.innings >= 3
          ? Math.round(average * 100) / 100
          : null,
      strikeRate:
        strikeRate !== null ? Math.round(strikeRate * 100) / 100 : null,
      fours: r.total_fours,
      sixes: r.total_sixes,
      fifties: r.fifties,
      hundreds: r.hundreds,
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
