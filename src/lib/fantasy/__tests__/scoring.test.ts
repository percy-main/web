import { describe, expect, it } from "vitest";
import {
  calculateBattingPoints,
  calculateBowlingPoints,
  calculateFieldingPoints,
  calculateMatchPoints,
} from "../scoring";

describe("calculateBattingPoints", () => {
  it("awards 1 point per run", () => {
    const result = calculateBattingPoints({
      runs: 35,
      balls: 40,
      fours: 0,
      sixes: 0,
      notOut: false,
      battingPosition: 3,
    });
    expect(result.runs).toBe(35);
  });

  it("awards bonus for fours and sixes", () => {
    const result = calculateBattingPoints({
      runs: 30,
      balls: 20,
      fours: 4,
      sixes: 2,
      notOut: false,
      battingPosition: 4,
    });
    expect(result.fours).toBe(4);
    expect(result.sixes).toBe(4);
  });

  it("awards fifty bonus for 50–99 runs", () => {
    const result = calculateBattingPoints({
      runs: 75,
      balls: 80,
      fours: 5,
      sixes: 1,
      notOut: false,
      battingPosition: 1,
    });
    expect(result.fiftyBonus).toBe(20);
    expect(result.hundredBonus).toBe(0);
  });

  it("awards hundred bonus (not fifty) for 100+ runs", () => {
    const result = calculateBattingPoints({
      runs: 120,
      balls: 100,
      fours: 10,
      sixes: 3,
      notOut: false,
      battingPosition: 3,
    });
    expect(result.fiftyBonus).toBe(0);
    expect(result.hundredBonus).toBe(50);
  });

  it("applies duck penalty for 0 runs when out at position 1-7", () => {
    const result = calculateBattingPoints({
      runs: 0,
      balls: 3,
      fours: 0,
      sixes: 0,
      notOut: false,
      battingPosition: 5,
    });
    expect(result.duckPenalty).toBe(-10);
    expect(result.total).toBe(-10);
  });

  it("does not apply duck penalty for position 8+", () => {
    const result = calculateBattingPoints({
      runs: 0,
      balls: 3,
      fours: 0,
      sixes: 0,
      notOut: false,
      battingPosition: 8,
    });
    expect(result.duckPenalty).toBe(0);
    expect(result.total).toBe(0);
  });

  it("does not apply duck penalty for position 11", () => {
    const result = calculateBattingPoints({
      runs: 0,
      balls: 1,
      fours: 0,
      sixes: 0,
      notOut: false,
      battingPosition: 11,
    });
    expect(result.duckPenalty).toBe(0);
    expect(result.total).toBe(0);
  });

  it("applies duck penalty at position 7 boundary", () => {
    const result = calculateBattingPoints({
      runs: 0,
      balls: 5,
      fours: 0,
      sixes: 0,
      notOut: false,
      battingPosition: 7,
    });
    expect(result.duckPenalty).toBe(-10);
  });

  it("does not apply duck penalty when not out on 0", () => {
    const result = calculateBattingPoints({
      runs: 0,
      balls: 3,
      fours: 0,
      sixes: 0,
      notOut: true,
      battingPosition: 1,
    });
    expect(result.duckPenalty).toBe(0);
    expect(result.total).toBe(0);
  });

  it("calculates correct total for a typical innings", () => {
    // 50 runs, 6 fours, 2 sixes = 50 + 6 + 4 + 20 (fifty bonus) = 80
    const result = calculateBattingPoints({
      runs: 50,
      balls: 60,
      fours: 6,
      sixes: 2,
      notOut: false,
      battingPosition: 3,
    });
    expect(result.total).toBe(80);
  });
});

describe("calculateBowlingPoints", () => {
  it("awards 10 points per wicket", () => {
    const result = calculateBowlingPoints({
      overs: "10",
      maidens: 0,
      runs: 40,
      wickets: 2,
    });
    expect(result.wickets).toBe(20);
  });

  it("awards 10 points per maiden", () => {
    const result = calculateBowlingPoints({
      overs: "10",
      maidens: 3,
      runs: 25,
      wickets: 0,
    });
    expect(result.maidens).toBe(30);
  });

  it("awards 3-wicket bonus for 3–4 wickets", () => {
    const result = calculateBowlingPoints({
      overs: "10",
      maidens: 0,
      runs: 30,
      wickets: 3,
    });
    expect(result.threeWicketBonus).toBe(15);
    expect(result.fiveWicketBonus).toBe(0);
  });

  it("awards 5-wicket bonus (not 3-wicket) for 5+ wickets", () => {
    const result = calculateBowlingPoints({
      overs: "10",
      maidens: 0,
      runs: 30,
      wickets: 5,
    });
    expect(result.threeWicketBonus).toBe(0);
    expect(result.fiveWicketBonus).toBe(30);
  });

  it("awards economy bonus for rate < 4.0 with enough overs", () => {
    const result = calculateBowlingPoints({
      overs: "10",
      maidens: 2,
      runs: 30,
      wickets: 1,
    });
    // Economy = 30/10 = 3.0, below 4.0 threshold
    expect(result.economyBonus).toBe(10);
  });

  it("does not award economy bonus for rate exactly 4.0", () => {
    const result = calculateBowlingPoints({
      overs: "10",
      maidens: 0,
      runs: 40,
      wickets: 0,
    });
    // Economy = 40/10 = 4.0, not strictly less than threshold
    expect(result.economyBonus).toBe(0);
  });

  it("applies economy penalty for rate > 7.0", () => {
    const result = calculateBowlingPoints({
      overs: "5",
      maidens: 0,
      runs: 50,
      wickets: 0,
    });
    // Economy = 50/5 = 10.0, above 7.0 threshold
    expect(result.economyBonus).toBe(-10);
  });

  it("does not apply economy penalty for rate exactly 7.0", () => {
    const result = calculateBowlingPoints({
      overs: "5",
      maidens: 0,
      runs: 35,
      wickets: 0,
    });
    // Economy = 35/5 = 7.0, not strictly greater than threshold
    expect(result.economyBonus).toBe(0);
  });

  it("does not apply economy bonus/penalty with fewer than 3 overs", () => {
    const result = calculateBowlingPoints({
      overs: "2",
      maidens: 0,
      runs: 2,
      wickets: 0,
    });
    // Economy = 1.0, great but below minimum overs
    expect(result.economyBonus).toBe(0);
  });

  it("handles partial overs like 9.3", () => {
    const result = calculateBowlingPoints({
      overs: "9.3",
      maidens: 0,
      runs: 35,
      wickets: 2,
    });
    // 9.3 overs = 9 + 3/6 = 9.5 overs, economy = 35/9.5 ≈ 3.68
    expect(result.economyBonus).toBe(10);
  });

  it("handles 0 overs without division by zero", () => {
    const result = calculateBowlingPoints({
      overs: "0",
      maidens: 0,
      runs: 0,
      wickets: 0,
    });
    expect(result.economyBonus).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("calculateFieldingPoints", () => {
  it("awards 10 points per catch for non-keepers", () => {
    const result = calculateFieldingPoints({
      catches: 3,
      runOuts: 0,
      stumpings: 0,
      isWicketkeeper: false,
    });
    expect(result.catches).toBe(30);
  });

  it("awards 5 points per catch for wicketkeepers", () => {
    const result = calculateFieldingPoints({
      catches: 3,
      runOuts: 0,
      stumpings: 0,
      isWicketkeeper: true,
    });
    expect(result.catches).toBe(15);
  });

  it("awards 15 points per run out", () => {
    const result = calculateFieldingPoints({
      catches: 0,
      runOuts: 2,
      stumpings: 0,
      isWicketkeeper: false,
    });
    expect(result.runOuts).toBe(30);
  });

  it("awards 15 points per stumping", () => {
    const result = calculateFieldingPoints({
      catches: 0,
      runOuts: 0,
      stumpings: 1,
      isWicketkeeper: true,
    });
    expect(result.stumpings).toBe(15);
  });
});

describe("calculateMatchPoints", () => {
  it("combines all disciplines and win bonus", () => {
    const result = calculateMatchPoints(
      { runs: 50, balls: 60, fours: 5, sixes: 1, notOut: false, battingPosition: 3 },
      { overs: "8", maidens: 1, runs: 30, wickets: 2 },
      { catches: 1, runOuts: 0, stumpings: 0, isWicketkeeper: false },
      { teamWon: true },
    );
    // Batting: 50 + 5 + 2 + 20 = 77
    // Bowling: 20 + 10 + 0 + 0 + 10 (econ 3.75) = 40
    // Fielding: 10
    // Win bonus: 10
    expect(result.batting?.total).toBe(77);
    expect(result.bowling?.total).toBe(40);
    expect(result.fielding?.total).toBe(10);
    expect(result.winBonus).toBe(10);
    expect(result.total).toBe(137);
  });

  it("handles null disciplines", () => {
    const result = calculateMatchPoints(
      null,
      null,
      { catches: 2, runOuts: 0, stumpings: 0, isWicketkeeper: false },
      { teamWon: false },
    );
    expect(result.batting).toBeNull();
    expect(result.bowling).toBeNull();
    expect(result.fielding?.total).toBe(20);
    expect(result.winBonus).toBe(0);
    expect(result.total).toBe(20);
  });

  it("awards no win bonus for a loss", () => {
    const result = calculateMatchPoints(
      { runs: 10, balls: 15, fours: 1, sixes: 0, notOut: false, battingPosition: 6 },
      null,
      null,
      { teamWon: false },
    );
    expect(result.winBonus).toBe(0);
    expect(result.total).toBe(11); // 10 runs + 1 four
  });
});
