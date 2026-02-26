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
});

export type Game = z.TypeOf<typeof schema>;

export const loader = async () => {
  const currentYear = new Date().getFullYear();
  const seasons = Array.from(
    { length: currentYear - 2025 + 1 },
    (_, i) => 2025 + i,
  );
  const responses = await Promise.all(
    seasons.map((season) => playCricket.getMatchesSummary({ season })),
  );
  const response = { matches: responses.flatMap((r) => r.matches) };

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
    };
  });
};

export const game = defineCollection({
  loader,
  schema,
});
