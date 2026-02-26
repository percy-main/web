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

const queryClient = new QueryClient();

type Props = {
  contentfulEntryId: string;
  season: number;
};

export function PlayerSeasonStats(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerSeasonStatsInner {...props} />
    </QueryClientProvider>
  );
}

function PlayerSeasonStatsInner({ contentfulEntryId, season }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["player-season-stats", contentfulEntryId, season],
    queryFn: async () => {
      const { data, error } =
        await actions.playCricket.getPlayerSeasonStats({
          contentfulEntryId,
          season,
        });
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="mt-6 space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-20 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className="mt-8">
      <h5>{season} Season Statistics</h5>

      {data.batting && (
        <div className="mt-4">
          <h6 className="mb-2 text-sm font-semibold text-gray-600">Batting</h6>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inn</TableHead>
                  <TableHead>NO</TableHead>
                  <TableHead className="font-bold">Runs</TableHead>
                  <TableHead>HS</TableHead>
                  <TableHead>Avg</TableHead>
                  <TableHead className="hidden sm:table-cell">SR</TableHead>
                  <TableHead className="hidden sm:table-cell">4s</TableHead>
                  <TableHead className="hidden sm:table-cell">6s</TableHead>
                  <TableHead className="hidden md:table-cell">50s</TableHead>
                  <TableHead className="hidden md:table-cell">100s</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{data.batting.innings}</TableCell>
                  <TableCell>{data.batting.notOuts}</TableCell>
                  <TableCell className="font-bold">
                    {data.batting.runs}
                  </TableCell>
                  <TableCell>{data.batting.highScore}</TableCell>
                  <TableCell>
                    {data.batting.average !== null
                      ? data.batting.average.toFixed(2)
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {data.batting.strikeRate !== null
                      ? data.batting.strikeRate.toFixed(1)
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {data.batting.fours}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {data.batting.sixes}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {data.batting.fifties}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {data.batting.hundreds}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {data.bowling && (
        <div className="mt-4">
          <h6 className="mb-2 text-sm font-semibold text-gray-600">Bowling</h6>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O</TableHead>
                  <TableHead className="hidden sm:table-cell">M</TableHead>
                  <TableHead>R</TableHead>
                  <TableHead className="font-bold">W</TableHead>
                  <TableHead>Avg</TableHead>
                  <TableHead className="hidden sm:table-cell">Econ</TableHead>
                  <TableHead className="hidden sm:table-cell">SR</TableHead>
                  <TableHead className="hidden md:table-cell">Best</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>{data.bowling.overs}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {data.bowling.maidens}
                  </TableCell>
                  <TableCell>{data.bowling.runs}</TableCell>
                  <TableCell className="font-bold">
                    {data.bowling.wickets}
                  </TableCell>
                  <TableCell>
                    {data.bowling.average !== null
                      ? data.bowling.average.toFixed(2)
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {data.bowling.economy !== null
                      ? data.bowling.economy.toFixed(2)
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {data.bowling.strikeRate !== null
                      ? data.bowling.strikeRate.toFixed(1)
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {data.bowling.bestWickets}
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
    </section>
  );
}
