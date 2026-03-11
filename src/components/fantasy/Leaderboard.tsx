import { Card } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Weekly leaderboard
// ---------------------------------------------------------------------------

function WeeklyLeaderboard() {
  const [selectedGameweek, setSelectedGameweek] = useState<number | undefined>(
    undefined,
  );

  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "weeklyLeaderboard", selectedGameweek],
    queryFn: async () => {
      const res = await actions.fantasy.getWeeklyLeaderboard({
        gameweek: selectedGameweek,
      });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!data || data.entries.length === 0) {
    return (
      <p className="text-gray-500">
        No scores yet. Scores are calculated after matches are played and synced.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Gameweek</label>
        <Select
          value={String(data.gameweek)}
          onValueChange={(val) => setSelectedGameweek(Number(val))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.availableGameweeks.map((gw) => (
              <SelectItem key={gw} value={String(gw)}>
                GW {gw}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">#</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead className="w-28 text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.entries.map((entry) => (
            <TableRow key={entry.teamId}>
              <TableCell className="font-medium">{entry.rank}</TableCell>
              <TableCell>{entry.ownerName}</TableCell>
              <TableCell className="text-right font-semibold">
                {entry.weeklyPoints}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Season leaderboard
// ---------------------------------------------------------------------------

function SeasonLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "seasonLeaderboard"],
    queryFn: async () => {
      const res = await actions.fantasy.getSeasonLeaderboard({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!data || data.entries.length === 0) {
    return (
      <p className="text-gray-500">
        No scores yet. Scores are calculated after matches are played and synced.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead className="w-20 text-right">GWs</TableHead>
          <TableHead className="w-28 text-right">Total Points</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.entries.map((entry) => (
          <TableRow key={entry.teamId}>
            <TableCell className="font-medium">{entry.rank}</TableCell>
            <TableCell>{entry.ownerName}</TableCell>
            <TableCell className="text-right text-gray-500">
              {entry.gameweeksPlayed}
            </TableCell>
            <TableCell className="text-right font-semibold">
              {entry.totalPoints}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Player leaderboard
// ---------------------------------------------------------------------------

type SortField = "total" | "batting" | "bowling" | "fielding";

function PlayerLeaderboard() {
  const [sortBy, setSortBy] = useState<SortField>("total");

  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "playerLeaderboard"],
    queryFn: async () => {
      const res = await actions.fantasy.getPlayerLeaderboard({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!data || data.entries.length === 0) {
    return (
      <p className="text-gray-500">
        No player scores yet. Scores are calculated after matches are played and
        synced.
      </p>
    );
  }

  const sorted = [...data.entries].sort((a, b) => {
    switch (sortBy) {
      case "batting":
        return b.battingPoints - a.battingPoints;
      case "bowling":
        return b.bowlingPoints - a.bowlingPoints;
      case "fielding":
        return b.fieldingPoints - a.fieldingPoints;
      default:
        return b.totalPoints - a.totalPoints;
    }
  });

  const headerButton = (field: SortField, label: string) => (
    <button
      type="button"
      className={`cursor-pointer text-right ${sortBy === field ? "font-bold text-gray-900 underline" : ""}`}
      onClick={() => setSortBy(field)}
    >
      {label}
    </button>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="w-16 text-right">M</TableHead>
          <TableHead className="w-20 text-right">
            {headerButton("batting", "Bat")}
          </TableHead>
          <TableHead className="w-20 text-right">
            {headerButton("bowling", "Bowl")}
          </TableHead>
          <TableHead className="w-20 text-right">
            {headerButton("fielding", "Field")}
          </TableHead>
          <TableHead className="w-24 text-right">
            {headerButton("total", "Total")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry, i) => (
          <TableRow key={entry.playCricketId}>
            <TableCell className="font-medium">{i + 1}</TableCell>
            <TableCell>{entry.playerName}</TableCell>
            <TableCell className="text-right text-gray-500">
              {entry.matchesPlayed}
            </TableCell>
            <TableCell className="text-right">{entry.battingPoints}</TableCell>
            <TableCell className="text-right">{entry.bowlingPoints}</TableCell>
            <TableCell className="text-right">{entry.fieldingPoints}</TableCell>
            <TableCell className="text-right font-semibold">
              {entry.totalPoints}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Leaderboard() {
  return (
    <Card className="p-4">
      <Tabs defaultValue="season">
        <TabsList>
          <TabsTrigger value="season">Season</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>
        <TabsContent value="season">
          <SeasonLeaderboard />
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklyLeaderboard />
        </TabsContent>
        <TabsContent value="players">
          <PlayerLeaderboard />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
