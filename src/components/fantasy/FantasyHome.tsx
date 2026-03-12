import { ChaosWeekBanner } from "@/components/fantasy/ChaosWeekBanner";
import { GameweekHighlights } from "@/components/fantasy/GameweekHighlights";
import { SandwichEfficiency } from "@/components/fantasy/SandwichEfficiency";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { actions } from "astro:actions";

const queryClient = new QueryClient();

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    setValue(0);
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function StatCard({
  value,
  label,
  colorClass,
}: {
  value: number;
  label: string;
  colorClass: string;
}) {
  const displayed = useCountUp(value);
  return (
    <Card>
      <CardContent className="py-6 text-center">
        <p className={`text-5xl font-bold ${colorClass}`}>{displayed}</p>
        <p className="mt-1 text-sm text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function Countdown({
  daysUntilLock,
  isPreSeason,
  locked,
  preSeasonStats,
}: {
  daysUntilLock: number;
  isPreSeason: boolean;
  locked: boolean;
  preSeasonStats?: { teamCount: number; totalSandwiches: number };
}) {
  if (isPreSeason) {
    return (
      <div className="md:col-span-2 grid grid-cols-3 gap-4">
        <StatCard
          value={daysUntilLock}
          label={daysUntilLock === 1 ? "day to go" : "days to go"}
          colorClass="text-blue-600"
        />
        <StatCard
          value={preSeasonStats?.teamCount ?? 0}
          label="teams registered"
          colorClass="text-gray-700"
        />
        <StatCard
          value={preSeasonStats?.totalSandwiches ?? 0}
          label="sandwiches consumed"
          colorClass="text-amber-600"
        />
      </div>
    );
  }

  if (locked) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Badge variant="destructive" className="mb-2">Teams Locked</Badge>
          <p className="text-sm text-gray-600">
            Teams are locked for match weekend. Editing reopens in {daysUntilLock} {daysUntilLock === 1 ? "day" : "days"}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6 text-center">
        <p className="text-lg font-medium text-gray-700">Team lock in</p>
        <p className="text-4xl font-bold text-amber-600">{daysUntilLock}</p>
        <p className="text-sm text-gray-500">
          {daysUntilLock === 1 ? "day" : "days"} until Friday 23:59 UK time
        </p>
      </CardContent>
    </Card>
  );
}

function TopTeams() {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "seasonLeaderboard"],
    queryFn: async () => {
      const res = await actions.fantasy.getSeasonLeaderboard({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading leaderboard...</p>;

  const top5 = data?.entries.slice(0, 5) ?? [];

  if (top5.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No scores yet — the leaderboard will appear once matches have been played.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead className="w-24 text-right">Points</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {top5.map((entry) => (
          <TableRow key={entry.teamId}>
            <TableCell className="font-medium">{entry.rank}</TableCell>
            <TableCell>
              <a
                href={`/members/fantasy?tab=leaderboards`}
                className="text-blue-600 hover:underline"
              >
                {entry.ownerName}
              </a>
            </TableCell>
            <TableCell className="text-right font-semibold">{entry.totalPoints}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OwnershipWidgets() {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "ownershipOverview"],
    queryFn: async () => {
      const res = await actions.fantasy.getOwnershipOverview({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading ownership data...</p>;

  if (!data || data.teamCount === 0) return null;

  const hasMostOwned = data.mostOwned.length > 0;
  const hasMostCaptained = data.mostCaptained.length > 0;
  if (!hasMostOwned && !hasMostCaptained) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {hasMostOwned && (
        <Card>
          <CardHeader>
            <CardTitle>Most Owned</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="w-20 text-right">Owned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mostOwned.map((player) => (
                  <TableRow key={player.playCricketId}>
                    <TableCell className="font-medium">{player.playerName}</TableCell>
                    <TableCell className="text-right">{player.ownershipPct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {hasMostCaptained && (
        <Card>
          <CardHeader>
            <CardTitle>Most Captained</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead className="w-20 text-right">Captain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mostCaptained.map((player) => (
                  <TableRow key={player.playCricketId}>
                    <TableCell className="font-medium">{player.playerName}</TableCell>
                    <TableCell className="text-right">{player.captainPct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DifferentialPicks() {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "ownershipOverview"],
    queryFn: async () => {
      const res = await actions.fantasy.getOwnershipOverview({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) return null;
  if (!data || data.teamCount === 0 || data.differentials.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Differential Picks</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-gray-500">Low-ownership players that could give you an edge</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="w-16 text-center">Cost</TableHead>
              <TableHead className="w-20 text-right">Points</TableHead>
              <TableHead className="w-20 text-right">Owned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.differentials.map((player) => (
              <TableRow key={player.playCricketId}>
                <TableCell className="font-medium">{player.playerName}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-sm">
                    {"🥪".repeat(player.sandwichCost)}
                  </span>
                </TableCell>
                <TableCell className="text-right">{player.points}</TableCell>
                <TableCell className="text-right">{player.ownershipPct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FantasyHomeContent() {
  const session = useSession();
  const isLoggedIn = !!session.data;

  const windowQuery = useQuery({
    queryKey: ["fantasy", "transferWindowPublic"],
    queryFn: async () => {
      const res = await actions.fantasy.getTransferWindowPublic({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  const windowInfo = windowQuery.data;

  const preSeasonStatsQuery = useQuery({
    queryKey: ["fantasy", "preSeasonStats"],
    queryFn: async () => {
      const res = await actions.fantasy.getPreSeasonStats({});
      if (res.error) throw res.error;
      return res.data;
    },
    enabled: !!windowInfo?.isPreSeason,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1>Fantasy Cricket</h1>
      </div>

      {/* Chaos week banner */}
      <ChaosWeekBanner />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Welcome section */}
        <Card className="md:col-span-2">
          <CardContent className="py-6">
            <h2 className="mb-3 text-xl font-semibold">Welcome to Percy Main Fantasy Cricket</h2>
            <p className="mb-4 text-gray-600">
              Pick your squad of 11 players from Percy Main&apos;s 1st and 2nd XI, choose a captain for double points,
              and compete against other members throughout the season. Points are scored from real match
              performances in league games.
            </p>
            <div className="flex flex-wrap gap-3">
              {isLoggedIn ? (
                <a
                  className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  href="/members/fantasy"
                >
                  Go to My Team
                </a>
              ) : (
                <a
                  className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  href="/auth/login"
                >
                  Log In to Play
                </a>
              )}
              <a
                className="text-dark inline-flex items-center rounded border border-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-200"
                href="/fantasy/rules"
              >
                View Scoring Rules
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Countdown */}
        {windowInfo && (
          <Countdown
            daysUntilLock={windowInfo.daysUntilLock}
            isPreSeason={windowInfo.isPreSeason}
            locked={windowInfo.locked}
            preSeasonStats={preSeasonStatsQuery.data}
          />
        )}

        {/* Quick facts */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Pick 11 players and designate a captain (2x points)</li>
              <li>Points from batting, bowling, fielding, and team wins</li>
              <li>Up to 3 transfers per gameweek during the season</li>
              <li>Teams lock Friday night, reopen Monday</li>
              <li>Only 1st XI and 2nd XI league matches count</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Match report */}
      <GameweekHighlights />

      {/* Ownership & efficiency widgets */}
      <OwnershipWidgets />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Differential picks (from ownership) */}
        <DifferentialPicks />

        {/* Sandwich efficiency */}
        <Card>
          <CardHeader>
            <CardTitle>Sandwich Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <SandwichEfficiency />
          </CardContent>
        </Card>
      </div>

      {/* Top 5 leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Season Leaderboard</CardTitle>
            <a
              className="text-sm text-blue-600 hover:underline"
              href="/members/fantasy?tab=leaderboards"
            >
              View full leaderboard
            </a>
          </div>
        </CardHeader>
        <CardContent>
          <TopTeams />
        </CardContent>
      </Card>
    </div>
  );
}

export function FantasyHome() {
  return (
    <QueryClientProvider client={queryClient}>
      <FantasyHomeContent />
    </QueryClientProvider>
  );
}
