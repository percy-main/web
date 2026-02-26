import * as location from "@/collections/location";
import { contentClient } from "@/lib/contentful/client";
import { defineCollection, z } from "astro:content";
import { PLAY_CRICKET_SITE_ID } from "astro:env/server";
import type { Entry } from "contentful";
import * as df from "date-fns";
import _ from "lodash";
import type {
  TypeGameDetailSkeleton,
  TypeSponsorSkeleton,
} from "../__generated__";
import * as playCricket from "../lib/play-cricket";
import type { ResultSummaryMatch } from "../lib/play-cricket";

export const team = z.object({
  id: z.string(),
  name: z.string(),
});

export const club = z.object({
  id: z.string(),
  name: z.string(),
});

export const league = z.object({
  id: z.string(),
  name: z.string(),
});

export const competition = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

const innings = z.object({
  teamBattingId: z.string(),
  teamName: z.string(),
  runs: z.number(),
  wickets: z.number(),
  overs: z.string(),
  declared: z.boolean(),
  allOut: z.boolean(),
});

export type Innings = z.TypeOf<typeof innings>;

const result = z.object({
  outcome: z.enum(["W", "L", "D", "T", "A", "C", "N"]).nullable(),
  description: z.string(),
  toss: z.string(),
  innings: z.array(innings),
});

export type Result = z.TypeOf<typeof result>;

export const schema = z.object({
  type: z.literal("game"),
  id: z.string(),
  createdAt: z.date(),
  home: z.boolean(),
  opposition: z.object({
    club,
    team,
  }),
  team,
  when: z.date().optional().nullable(),
  finish: z.date().optional().nullable(),
  league,
  competition,
  location: location.schema.optional(),
  sponsor: z
    .object({
      name: z.string(),
      logoUrl: z.string().optional(),
      message: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  description: z.any().optional(),
  result: result.optional(),
});

export type Game = z.TypeOf<typeof schema>;

function resolveOutcome(
  resultMatch: ResultSummaryMatch,
  ourTeamId: string,
): Result["outcome"] {
  const { result, result_applied_to, result_description } = resultMatch;

  if (!result || result === "") return null;

  const desc = result_description.toLowerCase();
  if (desc.includes("abandoned")) return "A";
  if (desc.includes("cancel")) return "C";
  if (desc.includes("tied") || result === "T") return "T";
  if (desc.includes("draw") || result === "D") return "D";
  if (desc.includes("no result")) return "N";

  if (result === "W") {
    return result_applied_to === ourTeamId ? "W" : "L";
  }

  return null;
}

function buildInnings(
  resultMatch: ResultSummaryMatch,
): Innings[] {
  return resultMatch.innings.map((inn) => {
    const teamId = inn.team_batting_id;
    const isHome = teamId === resultMatch.home_team_id;
    const teamName = isHome
      ? `${resultMatch.home_club_name} ${resultMatch.home_team_name}`
      : `${resultMatch.away_club_name} ${resultMatch.away_team_name}`;
    const runs = parseInt(inn.runs, 10) || 0;
    const wickets = parseInt(inn.wickets, 10) || 0;

    return {
      teamBattingId: teamId,
      teamName,
      runs,
      wickets,
      overs: inn.overs,
      declared: inn.declared,
      allOut: wickets >= 10,
    };
  });
}

export const loader = async () => {
  const currentYear = new Date().getFullYear();
  const seasons = Array.from(
    { length: currentYear - 2025 + 1 },
    (_, i) => 2025 + i,
  );
  const [matchResponses, resultResponses] = await Promise.all([
    Promise.all(
      seasons.map((season) => playCricket.getMatchesSummary({ season })),
    ),
    Promise.all(
      seasons.map((season) =>
        playCricket
          .getResultSummary({ season })
          .catch(() => ({ result_summary: [] })),
      ),
    ),
  ]);
  const response = { matches: matchResponses.flatMap((r) => r.matches) };
  const resultsByMatchId = _.keyBy(
    resultResponses.flatMap((r) => r.result_summary),
    (r) => r.id.toString(),
  );

  const cfGamesResponse =
    await contentClient.getEntries<TypeGameDetailSkeleton>({
      content_type: "gameDetail",
    });

  const gamesByGameId = _.keyBy(
    cfGamesResponse.items,
    (g) => g.fields.playCricketId,
  );

  let dbSponsorsByGameId: Record<
    string,
    {
      game_id: string;
      sponsor_name: string;
      display_name: string | null;
      sponsor_logo_url: string | null;
      sponsor_message: string | null;
      sponsor_website: string | null;
    }
  > = {};

  try {
    const { client } = await import("@/lib/db/client");
    const dbSponsorships = await client
      .selectFrom("game_sponsorship")
      .where("approved", "=", 1)
      .where("paid_at", "is not", null)
      .select([
        "game_id",
        "sponsor_name",
        "display_name",
        "sponsor_logo_url",
        "sponsor_message",
        "sponsor_website",
      ])
      .execute();

    dbSponsorsByGameId = _.keyBy(dbSponsorships, (s) => s.game_id);
  } catch {
    // DB not available (e.g. during astro sync in CI) - fall back to Contentful only
  }

  return response.matches.map((match) => {
    const home = match.home_club_id === PLAY_CRICKET_SITE_ID;
    const resultMatch = resultsByMatchId[match.id.toString()];

    const dbSponsorship = dbSponsorsByGameId[match.id.toString()];

    const cfSponsor = gamesByGameId[match.id.toString()]?.fields.sponsor as
      | Entry<TypeSponsorSkeleton, undefined>
      | undefined;

    const description = gamesByGameId[match.id.toString()]?.fields
      .description as unknown;

    const opposition = home
      ? {
          club: {
            id: match.away_club_id,
            name: match.away_club_name,
          },
          team: {
            id: match.away_team_id,
            name: match.away_team_name,
          },
        }
      : {
          club: {
            id: match.home_club_id,
            name: match.home_club_name,
          },
          team: {
            id: match.home_team_id,
            name: match.home_team_name,
          },
        };

    const team = home
      ? {
          id: match.home_team_id,
          name: match.home_team_name,
        }
      : {
          id: match.away_team_id,
          name: match.away_team_name,
        };

    const location = home
      ? {
          name: "Percy Main Community Sports Club",
          street: "St Johns Terract",
          city: "North Shields",
          postcode: "NE29 6HS",
          county: "Tyne and Wear",
          country: "United Kingdom",
        }
      : {
          name: match.home_club_name,
        };

    const when =
      match.match_date && match.match_time
        ? df.parse(
            `${match.match_date}-${match.match_time}`,
            "dd/MM/yyyy-HH:mm",
            new Date(),
          )
        : null;

    // adjust this based on game type when we have more information
    const finish = when ? df.add(when, { hours: 5 }) : null;

    return {
      type: "game",
      id: match.id.toString(),
      createdAt: df.parse(match.last_updated, "dd/MM/yyyy", new Date()),
      home,
      opposition,
      team,
      when,
      finish,
      league: {
        id: match.league_id,
        name: match.league_name,
      },
      competition: {
        id: match.competition_id,
        name: match.competition_name,
        type: match.competition_type,
      },
      location,
      sponsor: dbSponsorship
        ? {
            name: dbSponsorship.display_name ?? dbSponsorship.sponsor_name,
            logoUrl: dbSponsorship.sponsor_logo_url ?? undefined,
            message: dbSponsorship.sponsor_message ?? undefined,
            website: dbSponsorship.sponsor_website ?? undefined,
          }
        : cfSponsor?.fields
          ? { name: cfSponsor.fields.name }
          : undefined,
      description,
      result: resultMatch
        ? {
            outcome: resolveOutcome(resultMatch, team.id),
            description: resultMatch.result_description,
            toss: resultMatch.toss,
            innings: buildInnings(resultMatch),
          }
        : undefined,
    };
  });
};

export const game = defineCollection({
  loader,
  schema,
});
