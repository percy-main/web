/**
 * Gameweek logic for fantasy cricket.
 *
 * The fantasy season follows the cricket season calendar year.
 * Each gameweek runs Saturday to Friday, aligned with weekend matches.
 *
 * Lock deadline: Friday 23:59 UK time — teams are locked for the weekend.
 * Editing reopens: Monday 00:00 UK time.
 *
 * Pre-season (gameweek 0): before GW1 starts, unlimited team changes allowed.
 * In-season (gameweek 1+): max 3 transfers per gameweek, unless it's the
 * player's first-ever squad selection (which is always unlimited).
 */

/** Max transfers allowed per gameweek (after initial squad has been locked) */
export const MAX_TRANSFERS_PER_GAMEWEEK = 3;

/**
 * Season start dates — the Saturday that Gameweek 1 begins.
 * Add a new entry each year before the season starts.
 */
const SEASON_GW1_DATES: Record<string, string> = {
  "2026": "2026-04-18",
};

// ---------------------------------------------------------------------------
// UK timezone helpers
// ---------------------------------------------------------------------------

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

/** Build a UTC Date from UK date components (for date comparisons). */
function ukComponentsToUTC(uk: ReturnType<typeof getUKDateComponents>): Date {
  return new Date(
    Date.UTC(uk.year, uk.month - 1, uk.day, uk.hour, uk.minute, uk.second),
  );
}

// ---------------------------------------------------------------------------
// Season & gameweek calculations
// ---------------------------------------------------------------------------

/**
 * The GW1 start date for a season (as a UTC Date at 00:00).
 * Falls back to April 18 of the season year if not explicitly configured.
 */
export function getGW1StartDate(season: string): Date {
  const dateStr = SEASON_GW1_DATES[season];
  if (dateStr) {
    const parts = dateStr.split("-").map(Number);
    return new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1));
  }
  return new Date(Date.UTC(Number(season), 3, 18));
}

/**
 * The current fantasy cricket season year.
 *
 * Always returns the current calendar year. Pre-season for the upcoming
 * season begins in January; the season itself starts on the GW1 date.
 */
export function getCurrentSeason(): string {
  const { year } = getUKDateComponents();
  return year.toString();
}

/**
 * Get the current gameweek number.
 *
 * Returns 0 for pre-season (before GW1 start date).
 * Returns 1+ during the season (each week runs Saturday to Friday).
 */
export function getCurrentGameweek(season?: string): number {
  const s = season ?? getCurrentSeason();
  const gw1 = getGW1StartDate(s);
  const ukNow = ukComponentsToUTC(getUKDateComponents());

  if (ukNow.getTime() < gw1.getTime()) return 0; // Pre-season

  const diffMs = ukNow.getTime() - gw1.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

/**
 * Whether we're currently in the pre-season (before GW1).
 */
export function isPreSeason(season?: string): boolean {
  return getCurrentGameweek(season) === 0;
}

/**
 * Check if team editing is currently locked.
 *
 * Lock deadline: Friday 23:59 UK time.
 * Locked: Saturday and Sunday.
 * Reopens: Monday 00:00 UK time.
 *
 * Pre-season is never locked.
 */
export function isGameweekLocked(season?: string): boolean {
  if (isPreSeason(season)) return false;
  const dayOfWeek = getUKDayOfWeek();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
}

/**
 * Get information about the current transfer window.
 */
export function getTransferWindowInfo(season?: string) {
  const s = season ?? getCurrentSeason();
  const gameweek = getCurrentGameweek(s);
  const preseason = gameweek === 0;

  if (preseason) {
    const gw1 = getGW1StartDate(s);
    const ukNow = ukComponentsToUTC(getUKDateComponents());
    const daysUntilGW1 = Math.ceil(
      (gw1.getTime() - ukNow.getTime()) / (24 * 60 * 60 * 1000),
    );
    return {
      locked: false,
      gameweek: 0,
      isPreSeason: true,
      daysUntilLock: daysUntilGW1,
    };
  }

  const locked = isGameweekLocked(s);
  const dayOfWeek = getUKDayOfWeek();

  let daysUntilLock: number;
  if (locked) {
    // Days until Monday (reopening)
    daysUntilLock = dayOfWeek === 0 ? 1 : 2;
  } else {
    // Days until Friday 23:59 (next lock)
    daysUntilLock = 5 - dayOfWeek;
    if (daysUntilLock <= 0) daysUntilLock += 7;
  }

  return {
    locked,
    gameweek,
    isPreSeason: false,
    daysUntilLock,
  };
}
