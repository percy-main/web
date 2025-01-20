import { PLAY_CRICKET_API_KEY } from "astro:env/server";

type GetLeagueTableResponse = {
  league_table: [
    {
      id: string;
      name: string;
      headings: Record<string, string>;
      values: Array<{
        position: string;
        team_id: string;
        column_1: string;
        column_2: string;
        column_3: string;
        column_4: string;
        column_5: string;
        column_6: string;
        column_7: string;
        column_8: string;
        column_9: string;
        column_10: string;
        column_11: string;
        column_12: string;
      }>;
    },
  ];
};

export const getLeagueTable = async ({
  divisionId,
}: {
  divisionId: string;
}): Promise<GetLeagueTableResponse> => {
  const res = await fetch(
    `http://play-cricket.com/api/v2/league_table.json?division_id=${divisionId}&api_token=${PLAY_CRICKET_API_KEY}`,
  );

  return await res.json();
};
