import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { fetchLeaderboard } from "@/lib/leaderboard-client";
import { actions } from "astro:actions";
import { useMemo, useState } from "react";

const queryClient = new QueryClient();

type PersonProfile = {
  contentfulId: string;
  slug: string;
  name: string;
  photoUrl: string | null;
};

type BattingEntry = {
  playerId: string;
  playerName: string;
  contentfulEntryId: string | null;
  innings: number;
  notOuts: number;
  runs: number;
  highScore: number;
  average: number | null;
  strikeRate: number | null;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
};

type BowlingEntry = {
  playerId: string;
  playerName: string;
  contentfulEntryId: string | null;
  matches: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  average: number | null;
  economy: number | null;
  strikeRate: number | null;
  bestWickets: number;
};

type Team = {
  id: string;
  name: string;
  isJunior: boolean;
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-gray-500">
      <p>{message}</p>
    </div>
  );
}

function CompetitionFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (types: string[]) => void;
}) {
  const types = [
    { value: "League", label: "League" },
    { value: "Cup", label: "Cup" },
    { value: "Friendly", label: "Friendly" },
  ];

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => (
        <label
          key={type.value}
          className="flex cursor-pointer items-center gap-1.5"
        >
          <input
            type="checkbox"
            checked={selected.includes(type.value)}
            onChange={() => toggle(type.value)}
            className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
          />
          <span className="text-sm text-gray-700">{type.label}</span>
        </label>
      ))}
    </div>
  );
}

function TeamFilter({
  teams,
  selected,
  onChange,
}: {
  teams: Team[];
  selected: string;
  onChange: (teamId: string) => void;
}) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-green-700 focus:ring-green-700 focus:outline-none"
    >
      <option value="">All teams</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}

type SponsorInfo = {
  contentfulEntryId: string;
  sponsorName: string;
  sponsorWebsite: string | null;
};

function PlayerName({
  entry,
  profileMap,
  sponsorMap,
}: {
  entry: { playerName: string; contentfulEntryId: string | null };
  profileMap: Map<string, PersonProfile>;
  sponsorMap: Map<string, SponsorInfo>;
}) {
  const profile = entry.contentfulEntryId
    ? profileMap.get(entry.contentfulEntryId)
    : null;
  const sponsor = entry.contentfulEntryId
    ? sponsorMap.get(entry.contentfulEntryId)
    : null;

  return (
    <div className="flex flex-col">
      {profile ? (
        <a
          href={`/person/${profile.slug}`}
          className="font-medium text-green-800 underline decoration-green-800/30 underline-offset-2 hover:decoration-green-800"
        >
          {entry.playerName}
        </a>
      ) : (
        <span className="font-medium">{entry.playerName}</span>
      )}
      {sponsor && (
        <span className="text-xs text-gray-500">
          Sponsored by {sponsor.sponsorName}
        </span>
      )}
    </div>
  );
}

function BattingTable({ entries, profileMap, sponsorMap }: { entries: BattingEntry[]; profileMap: Map<string, PersonProfile>; sponsorMap: Map<string, SponsorInfo> }) {
  if (entries.length === 0) {
    return <EmptyState message="No batting data available yet." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Inn</TableHead>
          <TableHead className="hidden text-right sm:table-cell">NO</TableHead>
          <TableHead className="text-right font-bold">Runs</TableHead>
          <TableHead className="text-right">HS</TableHead>
          <TableHead className="text-right">Avg</TableHead>
          <TableHead className="hidden text-right md:table-cell">SR</TableHead>
          <TableHead className="hidden text-right md:table-cell">4s</TableHead>
          <TableHead className="hidden text-right md:table-cell">6s</TableHead>
          <TableHead className="hidden text-right lg:table-cell">50s</TableHead>
          <TableHead className="hidden text-right lg:table-cell">100s</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, idx) => (
          <TableRow key={entry.playerId}>
            <TableCell className="text-gray-500">{idx + 1}</TableCell>
            <TableCell>
              <PlayerName entry={entry} profileMap={profileMap} sponsorMap={sponsorMap} />
            </TableCell>
            <TableCell className="text-right">{entry.innings}</TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              {entry.notOuts}
            </TableCell>
            <TableCell className="text-right font-bold">{entry.runs}</TableCell>
            <TableCell className="text-right">{entry.highScore}</TableCell>
            <TableCell className="text-right">
              {entry.average !== null ? entry.average.toFixed(2) : "-"}
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {entry.strikeRate !== null ? entry.strikeRate.toFixed(1) : "-"}
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {entry.fours}
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {entry.sixes}
            </TableCell>
            <TableCell className="hidden text-right lg:table-cell">
              {entry.fifties}
            </TableCell>
            <TableCell className="hidden text-right lg:table-cell">
              {entry.hundreds}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BowlingTable({ entries, profileMap, sponsorMap }: { entries: BowlingEntry[]; profileMap: Map<string, PersonProfile>; sponsorMap: Map<string, SponsorInfo> }) {
  if (entries.length === 0) {
    return <EmptyState message="No bowling data available yet." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">O</TableHead>
          <TableHead className="hidden text-right sm:table-cell">M</TableHead>
          <TableHead className="text-right">R</TableHead>
          <TableHead className="text-right font-bold">W</TableHead>
          <TableHead className="text-right">Avg</TableHead>
          <TableHead className="hidden text-right md:table-cell">Econ</TableHead>
          <TableHead className="hidden text-right md:table-cell">SR</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Best</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, idx) => (
          <TableRow key={entry.playerId}>
            <TableCell className="text-gray-500">{idx + 1}</TableCell>
            <TableCell>
              <PlayerName entry={entry} profileMap={profileMap} sponsorMap={sponsorMap} />
            </TableCell>
            <TableCell className="text-right">{entry.overs}</TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              {entry.maidens}
            </TableCell>
            <TableCell className="text-right">{entry.runs}</TableCell>
            <TableCell className="text-right font-bold">
              {entry.wickets}
            </TableCell>
            <TableCell className="text-right">
              {entry.average !== null ? entry.average.toFixed(2) : "-"}
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {entry.economy !== null ? entry.economy.toFixed(2) : "-"}
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {entry.strikeRate !== null ? entry.strikeRate.toFixed(1) : "-"}
            </TableCell>
            <TableCell className="hidden text-right lg:table-cell">
              {entry.bestWickets}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LeaderboardInner({ season, personProfiles }: { season: number; personProfiles: PersonProfile[] }) {
  const [isJunior, setIsJunior] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [competitionTypes, setCompetitionTypes] = useState<string[]>([]);
  const [discipline, setDiscipline] = useState<"batting" | "bowling">(
    "batting",
  );

  const profileMap = useMemo(
    () => new Map(personProfiles.map((p) => [p.contentfulId, p])),
    [personProfiles],
  );

  const sponsorsQuery = useQuery({
    queryKey: ["player-sponsors", season],
    queryFn: async () => {
      const result = await actions.playerSponsorship.getAllApproved({ season });
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const sponsorMap = useMemo(
    () => new Map((sponsorsQuery.data ?? []).map((s) => [s.contentfulEntryId, s])),
    [sponsorsQuery.data],
  );

  const teamsQuery = useQuery({
    queryKey: ["cricket-teams"],
    queryFn: async () => {
      const { data, error } = await actions.playCricket.getTeams();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

  const filteredTeams =
    teamsQuery.data?.teams.filter((t) => t.isJunior === isJunior) ?? [];

  const battingQuery = useQuery({
    queryKey: [
      "batting-leaderboard",
      season,
      teamId,
      competitionTypes,
      isJunior,
    ],
    queryFn: () =>
      fetchLeaderboard("batting", {
        season,
        teamId: teamId || undefined,
        competitionTypes:
          competitionTypes.length > 0 ? competitionTypes : undefined,
        isJunior,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const bowlingQuery = useQuery({
    queryKey: [
      "bowling-leaderboard",
      season,
      teamId,
      competitionTypes,
      isJunior,
    ],
    queryFn: () =>
      fetchLeaderboard("bowling", {
        season,
        teamId: teamId || undefined,
        competitionTypes:
          competitionTypes.length > 0 ? competitionTypes : undefined,
        isJunior,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const handleCategoryChange = (junior: boolean) => {
    setIsJunior(junior);
    setTeamId("");
  };

  return (
    <div className="space-y-4">
      {/* Category tabs: Seniors / Juniors */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          value={isJunior ? "junior" : "senior"}
          onValueChange={(v) => handleCategoryChange(v === "junior")}
        >
          <TabsList>
            <TabsTrigger value="senior">Seniors</TabsTrigger>
            <TabsTrigger value="junior">Juniors</TabsTrigger>
          </TabsList>
        </Tabs>

        <TeamFilter
          teams={filteredTeams}
          selected={teamId}
          onChange={setTeamId}
        />
      </div>

      {/* Competition type filter */}
      <CompetitionFilter
        selected={competitionTypes}
        onChange={setCompetitionTypes}
      />

      {/* Batting / Bowling discipline tabs */}
      <Tabs
        value={discipline}
        onValueChange={(v) => setDiscipline(v as "batting" | "bowling")}
      >
        <TabsList>
          <TabsTrigger value="batting">Batting</TabsTrigger>
          <TabsTrigger value="bowling">Bowling</TabsTrigger>
        </TabsList>

        <TabsContent value="batting">
          {battingQuery.isLoading ? (
            <LoadingSkeleton />
          ) : battingQuery.error ? (
            <EmptyState message="Failed to load batting leaderboard." />
          ) : (
            <BattingTable entries={battingQuery.data?.entries ?? []} profileMap={profileMap} sponsorMap={sponsorMap} />
          )}
          <p className="mt-2 text-xs text-gray-400">
            Averages shown for players with 3+ innings.
          </p>
        </TabsContent>

        <TabsContent value="bowling">
          {bowlingQuery.isLoading ? (
            <LoadingSkeleton />
          ) : bowlingQuery.error ? (
            <EmptyState message="Failed to load bowling leaderboard." />
          ) : (
            <BowlingTable entries={bowlingQuery.data?.entries ?? []} profileMap={profileMap} sponsorMap={sponsorMap} />
          )}
          <p className="mt-2 text-xs text-gray-400">
            Averages and strike rates shown for bowlers with 10+ overs.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CricketLeaderboard({ season, personProfiles = [] }: { season: number; personProfiles?: PersonProfile[] }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LeaderboardInner season={season} personProfiles={personProfiles} />
    </QueryClientProvider>
  );
}
