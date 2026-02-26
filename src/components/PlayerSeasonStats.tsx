import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

const queryClient = new QueryClient();

type Props = {
  contentfulEntryId: string;
};

export function PlayerSeasonStats(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerSeasonStatsInner {...props} />
    </QueryClientProvider>
  );
}

function PlayerSeasonStatsInner({ contentfulEntryId }: Props) {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const careerQuery = useQuery({
    queryKey: ["player-career-stats", contentfulEntryId],
    queryFn: async () => {
      const { data, error } =
        await actions.playCricket.getPlayerCareerStats({
          contentfulEntryId,
        });
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Default to most recent season once career data loads
  const season =
    selectedSeason ??
    (careerQuery.data?.seasons.length ? careerQuery.data.seasons[0] : null);

  const seasonQuery = useQuery({
    queryKey: ["player-season-stats", contentfulEntryId, season],
    queryFn: async () => {
      if (season === null) throw new Error("season is required");
      const { data, error } =
        await actions.playCricket.getPlayerSeasonStats({
          contentfulEntryId,
          season,
        });
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: season !== null,
  });

  // Render nothing while loading career data or when no linked player
  if (careerQuery.isLoading) return null;
  if (!careerQuery.data?.career) return null;

  const { career, seasons } = careerQuery.data;

  return (
    <section className="mt-8">
      <h5>Cricket Statistics</h5>

      {/* All-time career headline */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <CareerStat label="Matches" value={career.matches} />
        <CareerStat label="Total Runs" value={career.runs} />
        <CareerStat label="Total Wickets" value={career.wickets} />
        {career.highScore !== null && (
          <CareerStat label="High Score" value={career.highScore} />
        )}
        {career.bestBowling !== null && (
          <CareerStat label="Best Bowling" value={career.bestBowling} />
        )}
      </div>

      {/* Season selector + season stats */}
      {seasons.length > 0 && season !== null && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <h6 className="text-sm font-semibold text-gray-600">
              Season Stats
            </h6>
            <select
              value={season}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-green-700 focus:ring-green-700 focus:outline-none"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {seasonQuery.isLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded bg-gray-100"
                />
              ))}
            </div>
          ) : seasonQuery.data ? (
            <>
              {seasonQuery.data.batting && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    Batting
                  </p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Inn</TableHead>
                          <TableHead>NO</TableHead>
                          <TableHead className="font-bold">Runs</TableHead>
                          <TableHead>HS</TableHead>
                          <TableHead>Avg</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            SR
                          </TableHead>
                          <TableHead className="hidden sm:table-cell">
                            4s
                          </TableHead>
                          <TableHead className="hidden sm:table-cell">
                            6s
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            50s
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            100s
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            {seasonQuery.data.batting.innings}
                          </TableCell>
                          <TableCell>
                            {seasonQuery.data.batting.notOuts}
                          </TableCell>
                          <TableCell className="font-bold">
                            {seasonQuery.data.batting.runs}
                          </TableCell>
                          <TableCell>
                            {seasonQuery.data.batting.highScore}
                          </TableCell>
                          <TableCell>
                            {seasonQuery.data.batting.average !== null
                              ? seasonQuery.data.batting.average.toFixed(2)
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {seasonQuery.data.batting.strikeRate !== null
                              ? seasonQuery.data.batting.strikeRate.toFixed(1)
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {seasonQuery.data.batting.fours}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {seasonQuery.data.batting.sixes}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {seasonQuery.data.batting.fifties}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {seasonQuery.data.batting.hundreds}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {seasonQuery.data.bowling && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    Bowling
                  </p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>O</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            M
                          </TableHead>
                          <TableHead>R</TableHead>
                          <TableHead className="font-bold">W</TableHead>
                          <TableHead>Avg</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            Econ
                          </TableHead>
                          <TableHead className="hidden sm:table-cell">
                            SR
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Best
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            {seasonQuery.data.bowling.overs}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {seasonQuery.data.bowling.maidens}
                          </TableCell>
                          <TableCell>
                            {seasonQuery.data.bowling.runs}
                          </TableCell>
                          <TableCell className="font-bold">
                            {seasonQuery.data.bowling.wickets}
                          </TableCell>
                          <TableCell>
                            {seasonQuery.data.bowling.average !== null
                              ? seasonQuery.data.bowling.average.toFixed(2)
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {seasonQuery.data.bowling.economy !== null
                              ? seasonQuery.data.bowling.economy.toFixed(2)
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {seasonQuery.data.bowling.strikeRate !== null
                              ? seasonQuery.data.bowling.strikeRate.toFixed(1)
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {seasonQuery.data.bowling.bestBowling ?? "-"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <p className="mt-2 text-xs text-gray-400">
                View the full{" "}
                <a
                  href={`/leaderboard/${season}`}
                  className="text-green-800 underline"
                >
                  {season} season leaderboard
                </a>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              No statistics available for this season.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function CareerStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
      <p className="text-lg font-bold text-green-800">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
