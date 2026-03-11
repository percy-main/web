/**
 * Gameweek logic for fantasy cricket.
 *
 * Editing window: Monday 00:00 to Friday 23:59 UK time.
 * Locked: Saturday 00:00 to Sunday 23:59 UK time.
 *
 * Gameweek numbering starts from the season start date (first Monday of the
 * cricket season). Each gameweek runs Monday–Sunday.
 */

/** Max transfers allowed per gameweek */
export const MAX_TRANSFERS_PER_GAMEWEEK = 3;

/** The current cricket season year */
export function getCurrentSeason(): string {
  const now = new Date();
  return now.getFullYear().toString();
}

/**
 * Get the current UK date/time.
 */
function getUKNow(): Date {
  const nowStr = new Date().toLocaleString("en-GB", {
    timeZone: "Europe/London",
  });
  // Parse "DD/MM/YYYY, HH:MM:SS" format
  const [datePart = "", timePart = ""] = nowStr.split(", ");
  const [day, month, year] = datePart.split("/");
  const [hours, minutes, seconds] = timePart.split(":");
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );
}

/**
 * Check if the gameweek editing window is currently locked.
 *
 * Locked = Saturday 00:00 to Sunday 23:59 UK time.
 * Open = Monday 00:00 to Friday 23:59 UK time.
 */
export function isGameweekLocked(): boolean {
  const ukNow = getUKNow();
  const dayOfWeek = ukNow.getDay(); // 0 = Sunday, 6 = Saturday
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Get the current gameweek number (1-based).
 *
 * Gameweek 1 starts from the first Monday on or after April 1st of the current
 * season year. Each subsequent Monday starts a new gameweek.
 */
export function getCurrentGameweek(season?: string): number {
  const year = Number(season ?? getCurrentSeason());
  const ukNow = getUKNow();

  // Find the first Monday on or after April 1st
  const seasonStart = new Date(year, 3, 1); // April 1st
  const dayOfWeek = seasonStart.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(year, 3, 1 + daysUntilMonday);

  const diffMs = ukNow.getTime() - firstMonday.getTime();
  if (diffMs < 0) return 1; // Before season start

  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

/**
 * Get information about the current transfer window.
 */
export function getTransferWindowInfo(season?: string) {
  const locked = isGameweekLocked();
  const gameweek = getCurrentGameweek(season);

  // Calculate when the lock starts (next Saturday 00:00 UK time) or
  // when it ends (next Monday 00:00 UK time)
  const ukNow = getUKNow();
  const dayOfWeek = ukNow.getDay();

  let lockDate: Date;
  if (locked) {
    // Calculate next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    lockDate = new Date(
      ukNow.getFullYear(),
      ukNow.getMonth(),
      ukNow.getDate() + daysUntilMonday,
      0,
      0,
      0,
    );
  } else {
    // Calculate next Saturday
    const daysUntilSaturday = 6 - dayOfWeek;
    lockDate = new Date(
      ukNow.getFullYear(),
      ukNow.getMonth(),
      ukNow.getDate() + daysUntilSaturday,
      0,
      0,
      0,
    );
  }

  return {
    locked,
    gameweek,
    /** If locked: when editing reopens. If open: when editing locks. */
    nextChangeAt: lockDate.toISOString(),
  };
}
