import { z } from "zod";

// --- League Table ---

export const GetLeagueTableResponse = z.object({
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

// --- Match Summary ---

export const GetMatchSummaryResponse = z.object({
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

// --- Result Summary ---

export const ResultSummaryInnings = z.object({
  team_batting_id: z.string(),
  innings_number: z.number(),
  extra_byes: z.string(),
  extra_leg_byes: z.string(),
  extra_wides: z.string(),
  extra_no_balls: z.string(),
  extra_penalty_runs: z.string(),
  penalties_runs_awarded_in_other_innings: z.string(),
  total_extras: z.string(),
  runs: z.string(),
  wickets: z.string(),
  overs: z.string(),
  declared: z.boolean(),
  revised_target_runs: z.string(),
  revised_target_overs: z.string(),
});

export const ResultSummaryMatch = z.object({
  id: z.number(),
  status: z.string(),
  published: z.string(),
  last_updated: z.string(),
  league_name: z.string().optional().default(""),
  league_id: z.string().optional().default(""),
  competition_name: z.string().optional().default(""),
  competition_id: z.string().optional().default(""),
  competition_type: z.string().optional().default(""),
  match_type: z.string().optional().default(""),
  game_type: z.string().optional().default(""),
  match_date: z.string(),
  match_time: z.string(),
  ground_name: z.string().optional().default(""),
  ground_id: z.string().optional().default(""),
  home_team_name: z.string(),
  home_team_id: z.string(),
  home_club_name: z.string(),
  home_club_id: z.string(),
  away_team_name: z.string(),
  away_team_id: z.string(),
  away_club_name: z.string(),
  away_club_id: z.string(),
  toss_won_by_team_id: z.string().optional().default(""),
  toss: z.string().optional().default(""),
  batted_first: z.string().optional().default(""),
  result: z.string(),
  result_description: z.string().optional().default(""),
  result_applied_to: z.string().optional().default(""),
  innings: z.array(ResultSummaryInnings),
});

export type ResultSummaryMatch = z.TypeOf<typeof ResultSummaryMatch>;

export const GetResultSummaryResponse = z.object({
  result_summary: z.array(ResultSummaryMatch),
});

// --- Match Detail ---

export const MatchDetailBat = z.object({
  position: z.string(),
  batsman_name: z.string(),
  batsman_id: z.string(),
  how_out: z.string(),
  fielder_name: z.string().optional().default(""),
  fielder_id: z.string().optional().default(""),
  bowler_name: z.string().optional().default(""),
  bowler_id: z.string().optional().default(""),
  runs: z.string(),
  fours: z.string(),
  sixes: z.string(),
  balls: z.string(),
});

export const MatchDetailBowl = z.object({
  bowler_name: z.string(),
  bowler_id: z.string(),
  overs: z.string(),
  maidens: z.string(),
  runs: z.string(),
  wides: z.string(),
  wickets: z.string(),
  no_balls: z.string(),
});

export const MatchDetailFoW = z.object({
  runs: z.string(),
  wickets: z.number(),
  batsman_out_name: z.string(),
  batsman_out_id: z.string(),
  batsman_in_name: z.string().optional().default(""),
  batsman_in_id: z.string().optional().default(""),
  batsman_in_runs: z.string().optional().default(""),
});

export const MatchDetailInnings = z.object({
  team_batting_name: z.string(),
  team_batting_id: z.string(),
  innings_number: z.number(),
  extra_byes: z.string(),
  extra_leg_byes: z.string(),
  extra_wides: z.string(),
  extra_no_balls: z.string(),
  extra_penalty_runs: z.string(),
  penalties_runs_awarded_in_other_innings: z.string(),
  total_extras: z.string(),
  runs: z.string(),
  wickets: z.string(),
  overs: z.string(),
  declared: z.boolean(),
  revised_target_runs: z.string(),
  revised_target_overs: z.string(),
  bat: z.array(MatchDetailBat),
  bowl: z.array(MatchDetailBowl),
  fow: z.array(MatchDetailFoW),
});

export const MatchDetailPlayer = z.object({
  position: z.number(),
  player_name: z.string(),
  player_id: z.number(),
  captain: z.boolean(),
  wicket_keeper: z.boolean(),
});

export const MatchDetail = z.object({
  id: z.number(),
  home_team_name: z.string(),
  home_team_id: z.string(),
  home_club_name: z.string(),
  home_club_id: z.string().optional().default(""),
  away_team_name: z.string(),
  away_team_id: z.string(),
  away_club_name: z.string(),
  away_club_id: z.string().optional().default(""),
  toss: z.string().optional().default(""),
  batted_first: z.string().optional().default(""),
  result: z.string().optional().default(""),
  result_description: z.string().optional().default(""),
  result_applied_to: z.string().optional().default(""),
  match_type: z.string().optional().default(""),
  competition_type: z.string().optional().default(""),
  match_date: z.string().optional().default(""),
  season: z.string().optional().default(""),
  players: z.array(
    z.object({
      home_team: z.array(MatchDetailPlayer).optional(),
      away_team: z.array(MatchDetailPlayer).optional(),
    }),
  ),
  innings: z.array(MatchDetailInnings),
});

export const GetMatchDetailResponse = z.object({
  match_details: z.array(MatchDetail),
});

// --- Teams ---

export const GetTeamsResponse = z.object({
  teams: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      status: z.string(),
      last_updated: z.string(),
      site_id: z.union([z.string(), z.number()]),
      team_name: z.string(),
      other_team_name: z.string().optional().default(""),
      nickname: z.string().optional().default(""),
      team_captain: z.string().optional().default(""),
    }),
  ),
});
