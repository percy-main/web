import { describe, expect, it } from "vitest";
import {
  AGE_GROUPS,
  getAgeGroup,
  getAgeOnCutoff,
  getSeasonCutoffDate,
  getTeamName,
} from "../ageGroup";

describe("getSeasonCutoffDate", () => {
  it("returns September 1st of the given year", () => {
    const cutoff = getSeasonCutoffDate(2025);
    expect(cutoff.toISOString()).toBe("2025-09-01T00:00:00.000Z");
  });

  it("returns September 1st of the current year when no year given", () => {
    const cutoff = getSeasonCutoffDate();
    const expectedYear = new Date().getFullYear();
    expect(cutoff.getUTCFullYear()).toBe(expectedYear);
    expect(cutoff.getUTCMonth()).toBe(8); // 0-indexed
    expect(cutoff.getUTCDate()).toBe(1);
  });
});

describe("getAgeOnCutoff", () => {
  it("calculates age correctly for birthday before Sep 1", () => {
    // Born Jan 15, 2015 — on Sep 1, 2025, they are 10
    expect(getAgeOnCutoff("2015-01-15", 2025)).toBe(10);
  });

  it("calculates age correctly for birthday on Sep 1", () => {
    // Born Sep 1, 2015 — on Sep 1, 2025, they turn 10
    expect(getAgeOnCutoff("2015-09-01", 2025)).toBe(10);
  });

  it("calculates age correctly for birthday after Sep 1", () => {
    // Born Sep 2, 2015 — on Sep 1, 2025, they are still 9
    expect(getAgeOnCutoff("2015-09-02", 2025)).toBe(9);
  });

  it("calculates age correctly for birthday on Dec 31", () => {
    // Born Dec 31, 2014 — on Sep 1, 2025, they are 10
    expect(getAgeOnCutoff("2014-12-31", 2025)).toBe(10);
  });
});

describe("getAgeGroup", () => {
  it("assigns U11 for age < 11 on cutoff", () => {
    // Born 2015, age 10 on Sep 1, 2025
    expect(getAgeGroup("2015-01-15", 2025)).toBe("U11");
  });

  it("assigns U11 for very young players", () => {
    // Born 2020, age 5 on Sep 1, 2025
    expect(getAgeGroup("2020-01-15", 2025)).toBe("U11");
  });

  it("assigns U13 for age 11 on cutoff", () => {
    // Born Jan 15, 2014 — age 11 on Sep 1, 2025
    expect(getAgeGroup("2014-01-15", 2025)).toBe("U13");
  });

  it("assigns U13 for age 12 on cutoff", () => {
    // Born Jan 15, 2013 — age 12 on Sep 1, 2025
    expect(getAgeGroup("2013-01-15", 2025)).toBe("U13");
  });

  it("assigns U15 for age 13 on cutoff", () => {
    // Born Jan 15, 2012 — age 13 on Sep 1, 2025
    expect(getAgeGroup("2012-01-15", 2025)).toBe("U15");
  });

  it("assigns U15 for age 14 on cutoff", () => {
    // Born Jan 15, 2011 — age 14 on Sep 1, 2025
    expect(getAgeGroup("2011-01-15", 2025)).toBe("U15");
  });

  it("assigns U19 for age 15 on cutoff", () => {
    // Born Jan 15, 2010 — age 15 on Sep 1, 2025
    expect(getAgeGroup("2010-01-15", 2025)).toBe("U19");
  });

  it("assigns U19 for age 18 on cutoff", () => {
    // Born Jan 15, 2007 — age 18 on Sep 1, 2025
    expect(getAgeGroup("2007-01-15", 2025)).toBe("U19");
  });

  it("returns null for age 19+ on cutoff", () => {
    // Born Jan 15, 2006 — age 19 on Sep 1, 2025
    expect(getAgeGroup("2006-01-15", 2025)).toBeNull();
  });

  it("handles the boundary: turning 11 exactly on Sep 1", () => {
    // Born Sep 1, 2014 — age 11 on Sep 1, 2025 => U13
    expect(getAgeGroup("2014-09-01", 2025)).toBe("U13");
  });

  it("handles the boundary: born Sep 2, still U11", () => {
    // Born Sep 2, 2014 — age 10 on Sep 1, 2025 => U11
    expect(getAgeGroup("2014-09-02", 2025)).toBe("U11");
  });

  it("matches the ticket example: boy born 2015 is in 2025 U11s", () => {
    // A boy born in 2015 will ALWAYS be in the 2025 U11s
    // Born mid-2015: age 10 on Sep 1, 2025 => U11
    expect(getAgeGroup("2015-06-15", 2025)).toBe("U11");
  });
});

describe("getTeamName", () => {
  it("returns team name for male player", () => {
    expect(getTeamName("2015-01-15", "male", 2025)).toBe("U11 Boys");
  });

  it("returns team name for female player", () => {
    expect(getTeamName("2015-01-15", "female", 2025)).toBe("U11 Girls");
  });

  it("handles uppercase sex value", () => {
    expect(getTeamName("2015-01-15", "Male", 2025)).toBe("U11 Boys");
  });

  it("returns null for overage player", () => {
    expect(getTeamName("2000-01-15", "male", 2025)).toBeNull();
  });
});

describe("AGE_GROUPS constant", () => {
  it("contains the expected age groups in order", () => {
    expect(AGE_GROUPS).toEqual(["U11", "U13", "U15", "U19"]);
  });
});
