/**
 * Age group calculation for junior cricket players.
 *
 * Uses the ECB standard September 1st cut-off: a player's age group for a
 * given season is determined by their age on September 1st of that season's
 * calendar year.
 */

export const AGE_GROUPS = ["U11", "U13", "U15", "U19"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

const AGE_GROUP_UPPER_BOUNDS: Record<AgeGroup, number> = {
  U11: 11,
  U13: 13,
  U15: 15,
  U19: 19,
};

/**
 * Returns the September 1st cut-off date for a given season year.
 * Defaults to the current calendar year.
 */
export function getSeasonCutoffDate(seasonYear?: number): Date {
  const year = seasonYear ?? new Date().getFullYear();
  return new Date(Date.UTC(year, 8, 1)); // month is 0-indexed, 8 = September
}

/**
 * Calculates a player's age on September 1st of the given season year.
 */
export function getAgeOnCutoff(dob: string, seasonYear?: number): number {
  const cutoff = getSeasonCutoffDate(seasonYear);
  const birthDate = new Date(dob);

  let age = cutoff.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = cutoff.getUTCMonth() - birthDate.getUTCMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && cutoff.getUTCDate() < birthDate.getUTCDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Returns the age group for a player based on their DOB, or null if they
 * are 19 or older on the cut-off date (i.e. too old for junior cricket).
 */
export function getAgeGroup(
  dob: string,
  seasonYear?: number,
): AgeGroup | null {
  const age = getAgeOnCutoff(dob, seasonYear);

  for (const group of AGE_GROUPS) {
    if (age < AGE_GROUP_UPPER_BOUNDS[group]) {
      return group;
    }
  }

  return null;
}

/**
 * Returns a human-readable team name, e.g. "U11 Boys" or "U15 Girls".
 * Returns null if the player is too old for any junior age group.
 */
export function getTeamName(
  dob: string,
  sex: string,
  seasonYear?: number,
): string | null {
  const group = getAgeGroup(dob, seasonYear);
  if (!group) return null;

  const genderLabel = sex.toLowerCase() === "male" ? "Boys" : "Girls";
  return `${group} ${genderLabel}`;
}
