import { PLAY_CRICKET_API_KEY, PLAY_CRICKET_SITE_ID } from "astro:env/server";
import type { z } from "zod";
import {
  GetLeagueTableResponse,
  GetMatchDetailResponse,
  GetMatchSummaryResponse,
  GetPlayersResponse,
  GetResultSummaryResponse,
  GetTeamsResponse,
} from "./schemas";

export type { ResultSummaryMatch } from "./schemas";

export const getLeagueTable = async ({
  divisionId,
}: {
  divisionId: string;
}): Promise<z.TypeOf<typeof GetLeagueTableResponse>> => {
  const res = await fetch(
    `https://play-cricket.com/api/v2/league_table.json?division_id=${divisionId}&api_token=${PLAY_CRICKET_API_KEY}`,
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

export const getMatchesSummary = async ({
  season,
}: {
  season: number;
}): Promise<z.TypeOf<typeof GetMatchSummaryResponse>> => {
  const res = await fetch(
    `https://play-cricket.com/api/v2/matches.json?site_id=${PLAY_CRICKET_SITE_ID}&season=${season}&api_token=${PLAY_CRICKET_API_KEY}`,
  );

  return await res.json().then((data) => {
    return GetMatchSummaryResponse.parse(data);
  });
};

export const getResultSummary = async ({
  season,
  teamId,
}: {
  season: number;
  teamId?: string;
}): Promise<z.TypeOf<typeof GetResultSummaryResponse>> => {
  const params = new URLSearchParams({
    site_id: PLAY_CRICKET_SITE_ID,
    season: season.toString(),
    api_token: PLAY_CRICKET_API_KEY,
    ...(teamId ? { team_id: teamId } : {}),
  });
  const res = await fetch(
    `https://play-cricket.com/api/v2/result_summary.json?${params}`,
  );

  return await res
    .json()
    .then((data) => GetResultSummaryResponse.parse(data))
    .catch((err) => {
      console.error(
        "Error parsing result summary response:",
        JSON.stringify(err, null, 2),
      );
      throw new Error("Failed to parse result summary response");
    });
};

export const getMatchDetail = async ({
  matchId,
}: {
  matchId: string;
}): Promise<z.TypeOf<typeof GetMatchDetailResponse>> => {
  const params = new URLSearchParams({
    match_id: matchId,
    api_token: PLAY_CRICKET_API_KEY,
  });
  const res = await fetch(
    `https://play-cricket.com/api/v2/match_detail.json?${params}`,
  );

  return await res
    .json()
    .then((data) => GetMatchDetailResponse.parse(data))
    .catch((err) => {
      console.error(
        "Error parsing match detail response:",
        JSON.stringify(err, null, 2),
      );
      throw new Error("Failed to parse match detail response");
    });
};

export const getPlayers = async (): Promise<
  z.TypeOf<typeof GetPlayersResponse>
> => {
  const res = await fetch(
    `https://play-cricket.com/api/v2/sites/${PLAY_CRICKET_SITE_ID}/players?api_token=${PLAY_CRICKET_API_KEY}&include_everyone=yes`,
  );

  return await res
    .json()
    .then((data) => GetPlayersResponse.parse(data))
    .catch((err) => {
      console.error(
        "Error parsing players response:",
        JSON.stringify(err, null, 2),
      );
      throw new Error("Failed to parse players response");
    });
};

export const getTeams = async (): Promise<
  z.TypeOf<typeof GetTeamsResponse>
> => {
  const res = await fetch(
    `https://play-cricket.com/api/v2/sites/${PLAY_CRICKET_SITE_ID}/teams.json?api_token=${PLAY_CRICKET_API_KEY}`,
  );

  return await res
    .json()
    .then((data) => GetTeamsResponse.parse(data))
    .catch((err) => {
      console.error(
        "Error parsing teams response:",
        JSON.stringify(err, null, 2),
      );
      throw new Error("Failed to parse teams response");
    });
};
