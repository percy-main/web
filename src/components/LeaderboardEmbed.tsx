import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { currentCricketSeason } from "@/lib/cricket-season";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

type Props = {
  title?: string;
  season?: number;
  discipline?: "batting" | "bowling" | "both";
  category?: "seniors" | "juniors";
  limit?: number;
};

function BattingMiniTable({
  entries,
}: {
  entries: Array<{ playerName: string; runs: number; innings: number; average: number | null; highScore: number }>;
}) {
  if (entries.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Inn</TableHead>
          <TableHead className="text-right font-bold">Runs</TableHead>
          <TableHead className="text-right">HS</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, idx) => (
          <TableRow key={idx}>
            <TableCell className="text-gray-400">{idx + 1}</TableCell>
            <TableCell>
              <span className="font-medium">{entry.playerName}</span>
            </TableCell>
            <TableCell className="text-right">{entry.innings}</TableCell>
            <TableCell className="text-right font-bold">{entry.runs}</TableCell>
            <TableCell className="text-right">{entry.highScore}</TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              {entry.average?.toFixed(2) ?? "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BowlingMiniTable({
  entries,
}: {
  entries: Array<{ playerName: string; wickets: number; overs: string; average: number | null }>;
}) {
  if (entries.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Overs</TableHead>
          <TableHead className="text-right font-bold">Wkts</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, idx) => (
          <TableRow key={idx}>
            <TableCell className="text-gray-400">{idx + 1}</TableCell>
            <TableCell>
              <span className="font-medium">{entry.playerName}</span>
            </TableCell>
            <TableCell className="text-right">{entry.overs}</TableCell>
            <TableCell className="text-right font-bold">
              {entry.wickets}
            </TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              {entry.average?.toFixed(2) ?? "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  );
}

function LeaderboardEmbedInner({
  title,
  season: explicitSeason,
  discipline = "both",
  category = "seniors",
  limit = 10,
}: Props) {
  const targetSeason = explicitSeason ?? currentCricketSeason();
  const isJunior = category === "juniors";
  const showBatting = discipline === "batting" || discipline === "both";
  const showBowling = discipline === "bowling" || discipline === "both";
  const [activeDiscipline, setActiveDiscipline] = useState<
    "batting" | "bowling"
  >(showBatting ? "batting" : "bowling");

  const battingQuery = useQuery({
    queryKey: ["leaderboard-embed-batting", targetSeason, isJunior, limit],
    queryFn: async () => {
      const primary = await actions.playCricket.getBattingLeaderboard({
        season: targetSeason,
        isJunior,
        limit,
      });
      if (primary.error) throw primary.error;
      if (primary.data && primary.data.entries.length > 0) {
        return { data: primary.data, season: targetSeason };
      }
      const fallback = await actions.playCricket.getBattingLeaderboard({
        season: targetSeason - 1,
        isJunior,
        limit,
      });
      if (fallback.error) throw fallback.error;
      return { data: fallback.data, season: targetSeason - 1 };
    },
    staleTime: 10 * 60 * 1000,
    enabled: showBatting,
  });

  const bowlingQuery = useQuery({
    queryKey: ["leaderboard-embed-bowling", targetSeason, isJunior, limit],
    queryFn: async () => {
      const primary = await actions.playCricket.getBowlingLeaderboard({
        season: targetSeason,
        isJunior,
        limit,
      });
      if (primary.error) throw primary.error;
      if (primary.data && primary.data.entries.length > 0) {
        return { data: primary.data, season: targetSeason };
      }
      const fallback = await actions.playCricket.getBowlingLeaderboard({
        season: targetSeason - 1,
        isJunior,
        limit,
      });
      if (fallback.error) throw fallback.error;
      return { data: fallback.data, season: targetSeason - 1 };
    },
    staleTime: 10 * 60 * 1000,
    enabled: showBowling,
  });

  const isLoading =
    (showBatting && battingQuery.isLoading) ||
    (showBowling && bowlingQuery.isLoading);
  const hasError = battingQuery.error ?? bowlingQuery.error;

  if (hasError) return null;

  const battingEntries = battingQuery.data?.data?.entries ?? [];
  const bowlingEntries = bowlingQuery.data?.data?.entries ?? [];

  const effectiveSeason =
    battingQuery.data?.season ?? bowlingQuery.data?.season ?? targetSeason;

  if (
    !isLoading &&
    battingEntries.length === 0 &&
    bowlingEntries.length === 0
  ) {
    return null;
  }

  const displayTitle = title ?? `${effectiveSeason} Season Leaderboard`;

  // Single discipline — no tabs needed
  if (discipline !== "both") {
    return (
      <div className="my-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dark">{displayTitle}</h3>
        </div>
        {isLoading ? (
          <LoadingSkeleton />
        ) : discipline === "batting" ? (
          <BattingMiniTable entries={battingEntries} />
        ) : (
          <BowlingMiniTable entries={bowlingEntries} />
        )}
        <div className="mt-3 text-right">
          <a
            href={`/leaderboard/${effectiveSeason}`}
            className="text-sm font-medium text-primary transition hover:text-primary-light"
          >
            View full leaderboard &rarr;
          </a>
        </div>
      </div>
    );
  }

  // Both disciplines — use tabs
  return (
    <div className="my-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dark">{displayTitle}</h3>
      </div>
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Tabs
          value={activeDiscipline}
          onValueChange={(v) =>
            setActiveDiscipline(v as "batting" | "bowling")
          }
        >
          <TabsList>
            <TabsTrigger value="batting">Batting</TabsTrigger>
            <TabsTrigger value="bowling">Bowling</TabsTrigger>
          </TabsList>
          <TabsContent value="batting">
            <BattingMiniTable entries={battingEntries} />
          </TabsContent>
          <TabsContent value="bowling">
            <BowlingMiniTable entries={bowlingEntries} />
          </TabsContent>
        </Tabs>
      )}
      <div className="mt-3 text-right">
        <a
          href={`/leaderboard/${effectiveSeason}`}
          className="text-sm font-medium text-primary transition hover:text-primary-light"
        >
          View full leaderboard &rarr;
        </a>
      </div>
    </div>
  );
}

// Player profile linking is handled by the full leaderboard page (/leaderboard/[year]).
// This embed renders player names as plain text with a "View full leaderboard" CTA.
export function LeaderboardEmbed(props: Props) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <LeaderboardEmbedInner {...props} />
    </QueryClientProvider>
  );
}
