/**
 * Compute the current cricket season year.
 * Cricket season runs April–September, so Jan–Mar uses the previous year.
 */
export function currentCricketSeason(): number {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
}
