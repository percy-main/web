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

/** Month (1-based) when the cricket season starts */
const SEASON_START_MONTH = 4; // April

/**
 * Get UK date components using Intl.DateTimeFormat for reliable timezone handling.
 * Returns numeric components in Europe/London time regardless of server timezone.
 */
function getUKDateComponents(date: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"), // 1-based
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Get the UK day of week (0 = Sunday, 6 = Saturday).
 * Uses Intl.DateTimeFormat to avoid timezone issues.
 */
function getUKDayOfWeek(date: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  });
  const weekday = fmt.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[weekday] ?? 0;
}

/**
 * The current cricket season year.
 *
 * Returns the current year if we're in April or later.
 * Returns the previous year if we're in Jan–March (still in last year's season).
 */
export function getCurrentSeason(): string {
  const { year, month } = getUKDateComponents();
  if (month < SEASON_START_MONTH) {
    return (year - 1).toString();
  }
  return year.toString();
}

/**
 * Check if the gameweek editing window is currently locked.
 *
 * Locked = Saturday 00:00 to Sunday 23:59 UK time.
 * Open = Monday 00:00 to Friday 23:59 UK time.
 */
export function isGameweekLocked(): boolean {
  const dayOfWeek = getUKDayOfWeek();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Get the current gameweek number (1-based).
 *
 * Gameweek 1 starts from the first Monday on or after April 1st of the
 * season year. Each subsequent Monday starts a new gameweek.
 */
export function getCurrentGameweek(season?: string): number {
  const year = Number(season ?? getCurrentSeason());
  const now = new Date();
  const uk = getUKDateComponents(now);

  // Find the first Monday on or after April 1st in UTC
  // We work with UTC dates for the comparison since we only need day-level precision
  const april1 = new Date(Date.UTC(year, 3, 1)); // April 1st UTC
  const april1Day = april1.getUTCDay();
  const daysUntilMonday =
    april1Day === 0 ? 1 : april1Day === 1 ? 0 : 8 - april1Day;
  const firstMonday = new Date(
    Date.UTC(year, 3, 1 + daysUntilMonday),
  );

  // Build a UTC date from UK components for comparison
  const ukNowUtc = new Date(
    Date.UTC(uk.year, uk.month - 1, uk.day, uk.hour, uk.minute, uk.second),
  );

  const diffMs = ukNowUtc.getTime() - firstMonday.getTime();
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
  const dayOfWeek = getUKDayOfWeek();

  let daysUntilChange: number;
  if (locked) {
    // Next Monday
    daysUntilChange = dayOfWeek === 0 ? 1 : 2;
  } else {
    // Next Saturday
    daysUntilChange = 6 - dayOfWeek;
  }

  return {
    locked,
    gameweek,
    /** Days until the next state change */
    daysUntilChange,
  };
}
