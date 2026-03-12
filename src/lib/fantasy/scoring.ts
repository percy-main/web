/**
 * Fantasy cricket scoring engine.
 *
 * Static config for point values, plus a calculation function that takes
 * a player's match performance and returns a points breakdown.
 *
 * Values tuned against 2025 season data to balance batters, bowlers, and
 * all-rounders. See PR for analysis details.
 */

// ---------------------------------------------------------------------------
// Scoring config
// ---------------------------------------------------------------------------

export const SCORING = {
  batting: {
    /** Points per run scored */
    perRun: 1,
    /** Bonus per four hit */
    perFour: 1,
    /** Bonus per six hit */
    perSix: 2,
    /** Bonus for reaching 50 runs */
    fiftyBonus: 20,
    /** Bonus for reaching 100 runs */
    hundredBonus: 50,
    /** Penalty for a duck (0 runs, not-out excluded). Only applies to batting/allrounder slots. */
    duckPenalty: -10,
  },
  bowling: {
    /** Points per wicket taken */
    perWicket: 10,
    /** Points per maiden over bowled */
    perMaiden: 10,
    /** Bonus for taking 3 wickets in an innings */
    threeWicketBonus: 15,
    /** Bonus for taking 5 wickets in an innings */
    fiveWicketBonus: 30,
    /** Economy bonus: awarded if economy rate < this threshold */
    economyBonusThreshold: 4.0,
    /** Points awarded for good economy */
    economyBonus: 10,
    /** Economy penalty: applied if economy rate > this threshold */
    economyPenaltyThreshold: 7.0,
    /** Points deducted for poor economy */
    economyPenalty: -10,
    /** Minimum overs bowled to qualify for economy bonus/penalty */
    economyMinOvers: 3,
  },
  fielding: {
    /** Points per catch (non-keeper) */
    perCatch: 10,
    /** Points per catch (wicketkeeper) — reduced since keepers get more chances */
    perCatchKeeper: 5,
    /** Points per run out */
    perRunOut: 15,
    /** Points per stumping */
    perStumping: 15,
  },
  team: {
    /** Points for being on the winning side */
    winBonus: 10,
  },
} as const;

// ---------------------------------------------------------------------------
// Sandwich budget & slot config
// ---------------------------------------------------------------------------

/** Maximum total sandwich cost across all 11 players */
export const SANDWICH_BUDGET = 30;

/** Required slot counts for team composition */
export const SLOT_COUNTS = { batting: 6, bowling: 4, allrounder: 1 } as const;

export type SlotType = "batting" | "bowling" | "allrounder";

/** Valid slot types for validation */
export const VALID_SLOT_TYPES: readonly SlotType[] = [
  "batting",
  "bowling",
  "allrounder",
] as const;

// ---------------------------------------------------------------------------
// League match filter
// ---------------------------------------------------------------------------

/**
 * Competition types that count as "league" matches for fantasy scoring.
 * Only 1st XI and 2nd XI league matches are eligible.
 *
 * These values should be verified against actual `competition_type` data from
 * match_performance_batting/bowling tables. Run the following query to inspect:
 *
 *   SELECT DISTINCT competition_type, COUNT(*) as matches
 *   FROM match_performance_batting
 *   WHERE season = 2025
 *   GROUP BY competition_type
 *   ORDER BY matches DESC
 *
 * Update this set when new competition types are encountered.
 */
export const LEAGUE_COMPETITION_TYPES = new Set([
  "League",
]);

/**
 * Play Cricket team IDs for 1st XI and 2nd XI.
 * Only matches involving these teams are eligible for fantasy scoring.
 *
 * These need to be set to the actual team IDs from the play_cricket_team table.
 * Run: SELECT id, name FROM play_cricket_team WHERE is_junior = 0
 */
export const ELIGIBLE_TEAM_IDS = new Set<string>([
  "68498", // 1st XI
  "71066", // 2nd XI
]);

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BattingInput {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  notOut: boolean;
}

export interface BowlingInput {
  overs: string; // e.g. "10" or "9.3"
  maidens: number;
  runs: number;
  wickets: number;
}

export interface FieldingInput {
  catches: number;
  runOuts: number;
  stumpings: number;
  isWicketkeeper: boolean;
}

export interface MatchContext {
  /** Did the player's team win? */
  teamWon: boolean;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface BattingBreakdown {
  runs: number;
  fours: number;
  sixes: number;
  fiftyBonus: number;
  hundredBonus: number;
  duckPenalty: number;
  total: number;
}

export interface BowlingBreakdown {
  wickets: number;
  maidens: number;
  threeWicketBonus: number;
  fiveWicketBonus: number;
  economyBonus: number;
  total: number;
}

export interface FieldingBreakdown {
  catches: number;
  runOuts: number;
  stumpings: number;
  total: number;
}

export interface PointsBreakdown {
  batting: BattingBreakdown | null;
  bowling: BowlingBreakdown | null;
  fielding: FieldingBreakdown | null;
  winBonus: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Calculation functions
// ---------------------------------------------------------------------------

/** Parse overs string (e.g. "9.3") into a decimal number of overs. */
function parseOvers(overs: string): number {
  const parts = overs.split(".");
  const whole = parseInt(parts[0] ?? "0") || 0;
  const partial = parseInt(parts[1] ?? "0") || 0;
  return whole + partial / 6;
}

export function calculateBattingPoints(
  input: BattingInput,
): BattingBreakdown {
  const s = SCORING.batting;

  const runs = input.runs * s.perRun;
  const fours = input.fours * s.perFour;
  const sixes = input.sixes * s.perSix;
  // Milestone bonuses are mutually exclusive: a century earns hundredBonus only,
  // not both fiftyBonus and hundredBonus. This matches standard fantasy cricket conventions.
  const fiftyBonus = input.runs >= 50 && input.runs < 100 ? s.fiftyBonus : 0;
  const hundredBonus = input.runs >= 100 ? s.hundredBonus : 0;
  const duckPenalty =
    input.runs === 0 && !input.notOut
      ? s.duckPenalty
      : 0;

  const total = runs + fours + sixes + fiftyBonus + hundredBonus + duckPenalty;

  return { runs, fours, sixes, fiftyBonus, hundredBonus, duckPenalty, total };
}

export function calculateBowlingPoints(
  input: BowlingInput,
): BowlingBreakdown {
  const s = SCORING.bowling;

  const wickets = input.wickets * s.perWicket;
  const maidens = input.maidens * s.perMaiden;
  const threeWicketBonus = input.wickets >= 3 && input.wickets < 5 ? s.threeWicketBonus : 0;
  const fiveWicketBonus = input.wickets >= 5 ? s.fiveWicketBonus : 0;

  const oversDecimal = parseOvers(input.overs);
  let economyBonus = 0;
  if (oversDecimal >= s.economyMinOvers) {
    const economyRate = input.runs / oversDecimal;
    if (economyRate < s.economyBonusThreshold) {
      economyBonus = s.economyBonus;
    } else if (economyRate > s.economyPenaltyThreshold) {
      economyBonus = s.economyPenalty;
    }
  }

  const total = wickets + maidens + threeWicketBonus + fiveWicketBonus + economyBonus;

  return { wickets, maidens, threeWicketBonus, fiveWicketBonus, economyBonus, total };
}

export function calculateFieldingPoints(
  input: FieldingInput,
): FieldingBreakdown {
  const s = SCORING.fielding;

  const catchPoints = input.isWicketkeeper
    ? input.catches * s.perCatchKeeper
    : input.catches * s.perCatch;
  const runOuts = input.runOuts * s.perRunOut;
  const stumpings = input.stumpings * s.perStumping;

  const total = catchPoints + runOuts + stumpings;

  return { catches: catchPoints, runOuts, stumpings, total };
}

/**
 * Calculate total fantasy points for a player's match performance.
 *
 * Pass `null` for batting/bowling/fielding if the player didn't participate
 * in that discipline (e.g. didn't bat = null batting).
 */
export function calculateMatchPoints(
  batting: BattingInput | null,
  bowling: BowlingInput | null,
  fielding: FieldingInput | null,
  context: MatchContext,
): PointsBreakdown {
  const battingBreakdown = batting
    ? calculateBattingPoints(batting)
    : null;
  const bowlingBreakdown = bowling
    ? calculateBowlingPoints(bowling)
    : null;
  const fieldingBreakdown = fielding
    ? calculateFieldingPoints(fielding)
    : null;

  const winBonus = context.teamWon ? SCORING.team.winBonus : 0;

  const total =
    (battingBreakdown?.total ?? 0) +
    (bowlingBreakdown?.total ?? 0) +
    (fieldingBreakdown?.total ?? 0) +
    winBonus;

  return {
    batting: battingBreakdown,
    bowling: bowlingBreakdown,
    fielding: fieldingBreakdown,
    winBonus,
    total,
  };
}
