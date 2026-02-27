import {
  BattingResponseSchema,
  type BattingResponse,
} from "@/pages/api/leaderboard/batting";
import {
  BowlingResponseSchema,
  type BowlingResponse,
} from "@/pages/api/leaderboard/bowling";

type LeaderboardParams = {
  season: number;
  isJunior?: boolean;
  teamId?: string;
  competitionTypes?: string[];
  limit?: number;
};

export type { BattingResponse, BowlingResponse };

export async function fetchLeaderboard(
  discipline: "batting",
  params: LeaderboardParams,
): Promise<BattingResponse>;
export async function fetchLeaderboard(
  discipline: "bowling",
  params: LeaderboardParams,
): Promise<BowlingResponse>;
export async function fetchLeaderboard(
  discipline: "batting" | "bowling",
  params: LeaderboardParams,
): Promise<BattingResponse | BowlingResponse> {
  const qs = new URLSearchParams();
  qs.set("season", String(params.season));
  if (params.isJunior) qs.set("isJunior", "true");
  if (params.teamId) qs.set("teamId", params.teamId);
  if (params.competitionTypes && params.competitionTypes.length > 0) {
    qs.set("competitionTypes", params.competitionTypes.join(","));
  }
  if (params.limit) qs.set("limit", String(params.limit));

  const res = await fetch(`/api/leaderboard/${discipline}?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Leaderboard fetch failed: ${res.status}`);
  }

  const json = await res.json();
  if (discipline === "batting") {
    return BattingResponseSchema.parse(json);
  }
  return BowlingResponseSchema.parse(json);
}
