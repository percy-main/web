import * as location from "@/collections/location";
import { defineCollection, z } from "astro:content";
import { PLAY_CRICKET_SITE_ID } from "astro:env/server";
import * as df from "date-fns";
import { getMatchesSummary } from "../lib/play-cricket";

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
  when: z.date(),
  finish: z.date().optional(),
  league,
  competition,
  location: location.schema.optional(),
});

export type Game = z.TypeOf<typeof schema>;

export const loader = async () => {
  const response = await getMatchesSummary({ season: 2025 });

  return response.matches.map((match) => {
    const home = match.home_club_id === PLAY_CRICKET_SITE_ID;

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

    const when = df.parse(
      `${match.match_date}-${match.match_time}`,
      "dd/MM/yyyy-HH:mm",
      new Date(),
    );

    // adjust this based on game type when we have more information
    const finish = df.add(when, { hours: 5 });

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
    };
  });
};

export const game = defineCollection({
  loader,
  schema,
});
