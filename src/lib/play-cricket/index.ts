import { z } from "astro/zod";
import { PLAY_CRICKET_API_KEY, PLAY_CRICKET_SITE_ID } from "astro:env/server";

const GetLeagueTableResponse = z.object({
  league_table: z.array(
    z.object({
      // play-cricket seems a touch... indecisive about this. we don't really care
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      headings: z.record(z.string()),
      values: z.array(
        z.object({
          position: z.string(),
          team_id: z.string(),
          column_1: z.string(),
          column_2: z.string(),
          column_3: z.string(),
          column_4: z.string(),
          column_5: z.string(),
          column_6: z.string(),
          column_7: z.string(),
          column_8: z.string(),
          column_9: z.string(),
          column_10: z.string(),
          column_11: z.string(),
          column_12: z.string(),
          column_13: z.string(),
          column_14: z.string().default(""),
        }),
      ),
    }),
  ),
});

export const getLeagueTable = async ({
  divisionId,
}: {
  divisionId: string;
}): Promise<z.TypeOf<typeof GetLeagueTableResponse>> => {
  const res = await fetch(
    `http://play-cricket.com/api/v2/league_table.json?division_id=${divisionId}&api_token=${PLAY_CRICKET_API_KEY}`,
  );

  return await res
    .json()
    .then((data) => GetLeagueTableResponse.parse(data))
    .catch((err) => {
      console.error(
        "Error parsing league table response:",
        JSON.stringify(err, null, 2),
      );
      throw new Error("Failed to parse league table response");
    });
};

const GetMatchSummaryResponse = z.object({
  matches: z.array(
    z.object({
      id: z.number(),
      status: z.string(),
      published: z.string(),
      last_updated: z.string(),
      league_name: z.string(),
      league_id: z.string(),
      competition_name: z.string(),
      competition_id: z.string(),
      competition_type: z.string(),
      match_type: z.string(),
      game_type: z.string(),
      season: z.string(),
      match_date: z.string(),
      match_time: z.string(),
      ground_name: z.string(),
      ground_id: z.string(),
      ground_latitude: z.string(),
      ground_longitude: z.string(),
      home_club_name: z.string(),
      home_team_name: z.string(),
      home_team_id: z.string(),
      home_club_id: z.string(),
      away_club_name: z.string(),
      away_team_name: z.string(),
      away_team_id: z.string(),
      away_club_id: z.string(),
      umpire_1_name: z.string(),
      umpire_1_id: z.string(),
      umpire_2_name: z.string(),
      umpire_2_id: z.string(),
      umpire_3_name: z.string(),
      umpire_3_id: z.string(),
      referee_name: z.string(),
      referee_id: z.string(),
      scorer_1_name: z.string(),
      scorer_1_id: z.string(),
      scorer_2_name: z.string(),
      scorer_2_id: z.string(),
    }),
  ),
});

export const getMatchesSummary = async ({
  season,
}: {
  season: number;
}): Promise<z.TypeOf<typeof GetMatchSummaryResponse>> => {
  const res = await fetch(
    `http://play-cricket.com/api/v2/matches.json?site_id=${PLAY_CRICKET_SITE_ID}&season=${season}&api_token=${PLAY_CRICKET_API_KEY}`,
  );

  return await res.json().then((data) => {
    console.log(JSON.stringify(data, null, 2));
    return GetMatchSummaryResponse.parse(data);
  });
};
