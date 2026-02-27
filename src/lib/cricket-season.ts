/**
 * Compute the current cricket season year.
 * Cricket season runs April–September, so Jan–Mar uses the previous year.
 */
export function currentCricketSeason(): number {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
}

/**
 * Fetch leaderboard data with automatic season fallback.
 * If the target season has no data, falls back to the previous season.
 */
export async function fetchWithSeasonFallback<
  T extends { entries: unknown[] },
>(
  fetcher: (season: number) => Promise<{ data?: T; error?: unknown }>,
  season: number,
): Promise<{ data: T; season: number }> {
  const result = await fetcher(season);
  if (result.error) {
    throw result.error instanceof Error
      ? result.error
      : new Error("Leaderboard fetch failed");
  }
  if (result.data && result.data.entries.length > 0) {
    return { data: result.data, season };
  }
  // Fall back to previous season
  const fallback = await fetcher(season - 1);
  if (fallback.error) {
    throw fallback.error instanceof Error
      ? fallback.error
      : new Error("Leaderboard fallback fetch failed");
  }
  if (!fallback.data) {
    return { data: { entries: [] } as unknown as T, season: season - 1 };
  }
  return { data: fallback.data, season: season - 1 };
}
