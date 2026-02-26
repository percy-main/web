import type { Result, Innings } from "@/collections/game";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { isPast } from "date-fns";

function formatInningsScore(inn: Innings): string {
  const wicketsPart = inn.allOut ? "" : `/${inn.wickets}`;
  const declaredPart = inn.declared ? " dec" : "";
  const oversPart = inn.overs ? ` (${inn.overs} ov)` : "";
  return `${inn.runs}${wicketsPart}${declaredPart}${oversPart}`;
}

type OutcomeBadgeProps = {
  outcome: Result["outcome"];
};

function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  switch (outcome) {
    case "W":
      return <Badge variant="success">Won</Badge>;
    case "L":
      return <Badge variant="destructive">Lost</Badge>;
    case "D":
      return <Badge variant="default">Draw</Badge>;
    case "T":
      return <Badge variant="warning">Tied</Badge>;
    case "A":
      return <Badge variant="secondary">Abandoned</Badge>;
    case "C":
      return <Badge variant="secondary">Cancelled</Badge>;
    case "N":
      return <Badge variant="secondary">No Result</Badge>;
    default:
      return null;
  }
}

type ResultDisplayProps = {
  result: Result;
};

function ResultDisplay({ result }: ResultDisplayProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <OutcomeBadge outcome={result.outcome} />
          <span className="text-sm text-gray-600">{result.toss}</span>
        </div>
        <div className="flex flex-col gap-2">
          {result.innings.map((inn, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">{inn.teamName}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {formatInningsScore(inn)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type MatchResultInnerProps = {
  matchId: string;
  season: number;
  ourTeamId: string;
  when: string | null;
  ssrResult?: Result;
};

function MatchResultInner({
  matchId,
  season,
  ourTeamId,
  when,
  ssrResult,
}: MatchResultInnerProps) {
  const gameInPast = when ? isPast(new Date(when)) : false;
  const shouldFetch = !ssrResult && gameInPast;

  const query = useQuery({
    queryKey: ["getResultSummary", matchId],
    queryFn: () =>
      actions.playCricket.getResultSummary({ matchId, season, ourTeamId }),
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
  });

  const result = ssrResult ?? query.data?.data ?? undefined;

  if (!result) return null;

  return <ResultDisplay result={result} />;
}

const queryClient = new QueryClient();

type MatchResultProps = {
  matchId: string;
  season: number;
  ourTeamId: string;
  when: string | null;
  ssrResult?: Result;
};

export function MatchResult(props: MatchResultProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MatchResultInner {...props} />
    </QueryClientProvider>
  );
}
