import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { currentCricketSeason } from "@/lib/cricket-season";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

type PersonProfile = {
  contentfulId: string;
  slug: string;
  name: string;
};

type SponsorInfo = {
  contentfulEntryId: string;
  sponsorName: string;
  sponsorWebsite: string | null;
};

function PlayerLink({
  name,
  contentfulEntryId,
  profileMap,
  sponsorMap,
}: {
  name: string;
  contentfulEntryId: string | null;
  profileMap: Map<string, PersonProfile>;
  sponsorMap: Map<string, SponsorInfo>;
}) {
  const profile = contentfulEntryId
    ? profileMap.get(contentfulEntryId)
    : null;
  const sponsor = contentfulEntryId
    ? sponsorMap.get(contentfulEntryId)
    : null;

  return (
    <div className="flex flex-col">
      {profile ? (
        <a
          href={`/person/${profile.slug}`}
          className="font-medium text-green-800 underline decoration-green-800/30 underline-offset-2 hover:decoration-green-800"
        >
          {name}
        </a>
      ) : (
        <span className="font-medium">{name}</span>
      )}
      {sponsor && (
        <span className="text-xs text-gray-500">
          Sponsored by {sponsor.sponsorName}
        </span>
      )}
    </div>
  );
}

function MiniTable({
  title,
  children,
  headers,
}: {
  title: string;
  children: React.ReactNode;
  headers: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <h4 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
        {title}
      </h4>
      <Table>
        <TableHeader>
          <TableRow>{headers}</TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function SeasonLeadersInner({
  profileMap,
}: {
  profileMap: Map<string, PersonProfile>;
}) {
  const season = currentCricketSeason();

  const sponsorsQuery = useQuery({
    queryKey: ["player-sponsors", season],
    queryFn: async () => {
      const result = await actions.playerSponsorship.getAllApproved({ season });
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const sponsorMap = new Map(
    (sponsorsQuery.data ?? []).map((s) => [s.contentfulEntryId, s]),
  );

  const battingQuery = useQuery({
    queryKey: ["season-leaders-batting", season],
    queryFn: async () => {
      const primary = await actions.playCricket.getBattingLeaderboard({
        season,
        isJunior: false,
      });
      if (primary.error) throw primary.error;
      if (primary.data && primary.data.entries.length > 0) {
        return { data: primary.data, season };
      }
      const fallback = await actions.playCricket.getBattingLeaderboard({
        season: season - 1,
        isJunior: false,
      });
      if (fallback.error) throw fallback.error;
      return { data: fallback.data, season: season - 1 };
    },
    staleTime: 10 * 60 * 1000,
  });

  const bowlingQuery = useQuery({
    queryKey: ["season-leaders-bowling", season],
    queryFn: async () => {
      const primary = await actions.playCricket.getBowlingLeaderboard({
        season,
        isJunior: false,
      });
      if (primary.error) throw primary.error;
      if (primary.data && primary.data.entries.length > 0) {
        return { data: primary.data, season };
      }
      const fallback = await actions.playCricket.getBowlingLeaderboard({
        season: season - 1,
        isJunior: false,
      });
      if (fallback.error) throw fallback.error;
      return { data: fallback.data, season: season - 1 };
    },
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = battingQuery.isLoading || bowlingQuery.isLoading;
  const hasError = battingQuery.error ?? bowlingQuery.error;

  if (hasError) return null;

  const battingEntries = (battingQuery.data?.data?.entries ?? []).slice(0, 3);
  const bowlingEntries = (bowlingQuery.data?.data?.entries ?? []).slice(0, 3);

  const effectiveSeason =
    battingQuery.data?.season ?? bowlingQuery.data?.season ?? season;

  if (!isLoading && battingEntries.length === 0 && bowlingEntries.length === 0)
    return null;

  return (
    <div>
      <h3
        className="mb-6 text-center font-secondary font-bold"
        style={{ fontSize: "var(--text-h4)" }}
      >
        Season Leaders
      </h3>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className="h-8 animate-pulse rounded bg-gray-100"
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {battingEntries.length > 0 && (
            <MiniTable
              title="Top Run Scorers"
              headers={
                <>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    HS
                  </TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Avg
                  </TableHead>
                </>
              }
            >
              {battingEntries.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-gray-400">{idx + 1}</TableCell>
                  <TableCell>
                    <PlayerLink
                      name={entry.playerName}
                      contentfulEntryId={entry.contentfulEntryId}
                      profileMap={profileMap}
                      sponsorMap={sponsorMap}
                    />
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {entry.runs}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {entry.highScore}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {entry.average?.toFixed(2) ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </MiniTable>
          )}

          {bowlingEntries.length > 0 && (
            <MiniTable
              title="Top Wicket Takers"
              headers={
                <>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Wkts</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Overs
                  </TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Avg
                  </TableHead>
                </>
              }
            >
              {bowlingEntries.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-gray-400">{idx + 1}</TableCell>
                  <TableCell>
                    <PlayerLink
                      name={entry.playerName}
                      contentfulEntryId={entry.contentfulEntryId}
                      profileMap={profileMap}
                      sponsorMap={sponsorMap}
                    />
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {entry.wickets}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {entry.overs}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {entry.average?.toFixed(2) ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </MiniTable>
          )}
        </div>
      )}

      <div className="mt-4 text-center">
        <a
          href={`/leaderboard/${effectiveSeason}`}
          className="text-sm font-medium text-primary transition hover:text-primary-light"
        >
          View full {effectiveSeason} leaderboard &rarr;
        </a>
      </div>
    </div>
  );
}

export function SeasonLeaders({
  personProfiles = [],
}: {
  personProfiles?: PersonProfile[];
}) {
  const [queryClient] = useState(() => new QueryClient());
  const profileMap = new Map(
    personProfiles.map((p) => [p.contentfulId, p]),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SeasonLeadersInner profileMap={profileMap} />
    </QueryClientProvider>
  );
}
