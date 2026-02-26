import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

type InningsScore = {
  teamBattingName: string;
  teamBattingId: string;
  inningsNumber: number;
  runs: number;
  wickets: number;
  overs: string;
  declared: boolean;
};

type LiveMatch = {
  matchId: string;
  homeTeam: string;
  homeTeamId: string;
  awayTeam: string;
  awayTeamId: string;
  matchDate: string;
  matchTime: string;
  status: "not_started" | "in_progress" | "completed";
  toss: string | null;
  battedFirst: string | null;
  result: string | null;
  resultAppliedTo: string | null;
  innings: InningsScore[];
  lastUpdatedAt: string;
};

function formatScore(innings: InningsScore): string {
  const wicketsPart = innings.wickets >= 10 ? "" : `/${innings.wickets}`;
  const declaredPart = innings.declared ? " dec" : "";
  const oversPart = innings.overs ? ` (${innings.overs} ov)` : "";
  return `${innings.runs}${wicketsPart}${declaredPart}${oversPart}`;
}

function buildResultText(match: LiveMatch): string {
  if (!match.result) return "";

  const desc = match.result.toLowerCase();
  if (desc.includes("abandon")) return "Match abandoned";
  if (desc.includes("cancel")) return "Match cancelled";
  if (desc.includes("no result")) return "No result";
  if (desc.includes("draw")) return "Match drawn";
  if (desc.includes("tied") || desc.includes("tie")) return "Match tied";

  // If we have a specific result description, use it directly
  return match.result;
}

function LiveBadge() {
  return (
    <Badge className="gap-1.5 border-transparent bg-green-100 text-green-800">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" />
      </span>
      LIVE
    </Badge>
  );
}

function UpdatedAt({ timestamp }: { timestamp: string }) {
  const distance = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });
  return (
    <span className="text-xs text-gray-500">Updated {distance}</span>
  );
}

function MatchCard({ match }: { match: LiveMatch }) {
  return (
    <a
      href={`/calendar/event/${match.matchId}`}
      className="block transition-shadow hover:shadow-md"
    >
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          {/* Header row: teams and status badge */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {match.homeTeam}
              </p>
              <p className="text-xs text-gray-500">vs</p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {match.awayTeam}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {match.status === "in_progress" && <LiveBadge />}
              {match.status === "completed" && (
                <Badge variant="secondary">Final</Badge>
              )}
              {match.status === "not_started" && (
                <Badge variant="default">Upcoming</Badge>
              )}
            </div>
          </div>

          {/* Not started: show match time */}
          {match.status === "not_started" && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Starts at{" "}
                <span className="font-medium">{match.matchTime}</span>
              </p>
              {match.toss && (
                <p className="mt-1 text-xs text-gray-500">
                  Toss: {match.toss}
                </p>
              )}
            </div>
          )}

          {/* In progress: show live score */}
          {match.status === "in_progress" && (
            <div className="mt-2 space-y-1">
              {match.toss && (
                <p className="text-xs text-gray-500">Toss: {match.toss}</p>
              )}
              {match.innings.map((inn) => (
                <div
                  key={inn.inningsNumber}
                  className="flex items-baseline justify-between"
                >
                  <span className="truncate text-sm text-gray-700">
                    {inn.teamBattingName}
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-sm font-semibold tabular-nums text-gray-900">
                    {formatScore(inn)}
                  </span>
                </div>
              ))}
              <div className="pt-1">
                <UpdatedAt timestamp={match.lastUpdatedAt} />
              </div>
            </div>
          )}

          {/* Completed: show final score and result */}
          {match.status === "completed" && (
            <div className="mt-2 space-y-1">
              {match.innings.map((inn) => (
                <div
                  key={inn.inningsNumber}
                  className="flex items-baseline justify-between"
                >
                  <span className="truncate text-sm text-gray-700">
                    {inn.teamBattingName}
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-sm font-semibold tabular-nums text-gray-900">
                    {formatScore(inn)}
                  </span>
                </div>
              ))}
              {match.result && (
                <p className="pt-1 text-xs font-medium text-gray-600">
                  {buildResultText(match)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </a>
  );
}

function LiveScoreWidgetInner() {
  const { data, isLoading } = useQuery({
    queryKey: ["liveScores"],
    queryFn: () => actions.playCricket.getLiveScores.orThrow(),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  const matches = data?.matches;
  if (!matches || matches.length === 0) return null;

  return (
    <section className="bg-white py-6">
      <div className="container">
        <h3 className="mb-4 text-center text-lg font-semibold text-gray-900">
          Today's Matches
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.matchId} match={match} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function LiveScoreWidget() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <LiveScoreWidgetInner />
    </QueryClientProvider>
  );
}
