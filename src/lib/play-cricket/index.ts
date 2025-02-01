import { z } from "astro/zod";
import { PLAY_CRICKET_API_KEY } from "astro:env/server";

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

  return await res.json().then((data) => GetLeagueTableResponse.parse(data));
};
