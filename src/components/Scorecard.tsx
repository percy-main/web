import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import { isPast } from "date-fns";

type BattingEntry = {
  position: number;
  name: string;
  id: string;
  howOut: string | null | undefined;
  fielderName: string | null | undefined;
  bowlerName: string | null | undefined;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
};

type BowlingEntry = {
  name: string;
  id: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
};

type FoWEntry = {
  wicketNumber: number;
  runs: number;
  batsmanOutName: string;
};

type Extras = {
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalties: number;
  total: number;
};

type InningsTotal = {
  runs: number;
  wickets: number;
  overs: string;
  declared: boolean;
};

type ScorecardInnings = {
  teamBattingName: string;
  teamBattingId: string;
  inningsNumber: number;
  batting: BattingEntry[];
  bowling: BowlingEntry[];
  fallOfWickets: FoWEntry[];
  extras: Extras;
  total: InningsTotal;
};

type MatchDetailData = {
  homeTeamName: string;
  homeTeamId: string;
  awayTeamName: string;
  awayTeamId: string;
  toss: string;
  result: string;
  resultDescription: string;
  resultAppliedTo: string;
  battedFirst: string;
  innings: ScorecardInnings[];
};

function formatDismissal(entry: BattingEntry): string {
  const { howOut, fielderName, bowlerName } = entry;
  switch (howOut) {
    case "b":
      return `b ${bowlerName}`;
    case "ct":
      return fielderName && fielderName === bowlerName
        ? `c & b ${bowlerName}`
        : `c ${fielderName} b ${bowlerName}`;
    case "lbw":
      return `lbw b ${bowlerName}`;
    case "ro":
      return fielderName ? `run out (${fielderName})` : "run out";
    case "st":
      return `st ${fielderName} b ${bowlerName}`;
    case "hw":
      return `hit wicket b ${bowlerName}`;
    case "no":
      return "not out";
    case "rtd":
      return "retired";
    case "dnb":
      return "did not bat";
    default:
      return howOut || "unknown";
  }
}

function formatExtrasBreakdown(extras: Extras): string {
  const parts: string[] = [];
  if (extras.byes) parts.push(`b ${extras.byes}`);
  if (extras.legByes) parts.push(`lb ${extras.legByes}`);
  if (extras.wides) parts.push(`w ${extras.wides}`);
  if (extras.noBalls) parts.push(`nb ${extras.noBalls}`);
  if (extras.penalties) parts.push(`pen ${extras.penalties}`);
  return parts.join(", ");
}

function formatTotalScore(total: InningsTotal): string {
  const wicketsPart = total.wickets >= 10 ? "" : `/${total.wickets}`;
  const declaredPart = total.declared ? " dec" : "";
  const oversPart = total.overs ? ` (${total.overs} ov)` : "";
  return `${total.runs}${wicketsPart}${declaredPart}${oversPart}`;
}

function oversToDecimal(overs: string): number {
  const parts = overs.split(".");
  const completedOvers = parseInt(parts[0], 10) || 0;
  const balls = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  return completedOvers + balls / 6;
}

function buildResultText(data: MatchDetailData): string {
  if (!data.result) return "";
  if (data.result === "D") return "Match drawn";
  if (data.result === "T") return "Match tied";

  const desc = data.resultDescription.toLowerCase();
  if (desc.includes("abandon")) return "Match abandoned";
  if (desc.includes("cancel")) return "Match cancelled";
  if (desc.includes("no result")) return "No result";

  if (
    data.result === "W" &&
    data.resultAppliedTo &&
    data.innings.length >= 2
  ) {
    const winningTeamId = data.resultAppliedTo;
    const winningTeamName =
      winningTeamId === data.homeTeamId
        ? data.homeTeamName
        : data.awayTeamName;

    const secondInnings = data.innings[1];

    if (secondInnings.teamBattingId === winningTeamId) {
      const wicketsInHand = 10 - secondInnings.total.wickets;
      return `${winningTeamName} won by ${wicketsInHand} wicket${wicketsInHand !== 1 ? "s" : ""}`;
    } else {
      const firstInnings = data.innings[0];
      const margin = firstInnings.total.runs - secondInnings.total.runs;
      return `${winningTeamName} won by ${margin} run${margin !== 1 ? "s" : ""}`;
    }
  }

  return data.resultDescription;
}

function BattingCard({
  batting,
  extras,
  total,
}: {
  batting: BattingEntry[];
  extras: Extras;
  total: InningsTotal;
}) {
  const activeBatters = batting.filter((b) => b.howOut !== "dnb");
  const didNotBat = batting.filter((b) => b.howOut === "dnb");

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-full">Batter</TableHead>
            <TableHead className="text-right">R</TableHead>
            <TableHead className="text-right">B</TableHead>
            <TableHead className="text-right">4s</TableHead>
            <TableHead className="text-right">6s</TableHead>
            <TableHead className="text-right">SR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeBatters.map((b) => (
            <TableRow key={b.position}>
              <TableCell>
                <div>
                  <span className="font-medium">{b.name}</span>
                  <div className="text-xs text-gray-500">
                    {formatDismissal(b)}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {b.runs}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.balls || "-"}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.fours}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.sixes}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.balls > 0
                  ? ((b.runs / b.balls) * 100).toFixed(1)
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <span className="text-sm text-gray-600">
                Extras ({formatExtrasBreakdown(extras)})
              </span>
            </TableCell>
            <TableCell className="text-right font-mono font-semibold tabular-nums">
              {extras.total}
            </TableCell>
            <TableCell colSpan={4} />
          </TableRow>
          <TableRow className="border-t-2 font-bold">
            <TableCell>Total</TableCell>
            <TableCell
              className="text-right font-mono tabular-nums"
              colSpan={5}
            >
              {formatTotalScore(total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {didNotBat.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          <strong>Did not bat:</strong>{" "}
          {didNotBat.map((b) => b.name).join(", ")}
        </p>
      )}
    </div>
  );
}

function BowlingCard({ bowling }: { bowling: BowlingEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-full">Bowler</TableHead>
          <TableHead className="text-right">O</TableHead>
          <TableHead className="text-right">M</TableHead>
          <TableHead className="text-right">R</TableHead>
          <TableHead className="text-right">W</TableHead>
          <TableHead className="text-right">Econ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bowling.map((b, i) => {
          const decimalOvers = oversToDecimal(b.overs);
          const economy =
            decimalOvers > 0 ? (b.runs / decimalOvers).toFixed(1) : "-";
          return (
            <TableRow key={`${b.id}-${i}`}>
              <TableCell className="font-medium">{b.name}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.overs}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.maidens}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {b.runs}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {b.wickets}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {economy}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FallOfWickets({ fow }: { fow: FoWEntry[] }) {
  if (fow.length === 0) return null;
  return (
    <p className="text-xs text-gray-600">
      <strong>Fall of wickets:</strong>{" "}
      {fow.map((f, i) => (
        <span key={f.wicketNumber}>
          {i > 0 && ", "}
          {f.wicketNumber}-{f.runs} ({f.batsmanOutName})
        </span>
      ))}
    </p>
  );
}

function InningsCard({ innings }: { innings: ScorecardInnings }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{innings.teamBattingName}</CardTitle>
        <div className="text-sm font-semibold text-gray-700">
          {formatTotalScore(innings.total)}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <BattingCard
          batting={innings.batting}
          extras={innings.extras}
          total={innings.total}
        />
        <FallOfWickets fow={innings.fallOfWickets} />
        <div className="border-t pt-4">
          <h5 className="mb-2 text-sm font-semibold text-gray-700">Bowling</h5>
          <BowlingCard bowling={innings.bowling} />
        </div>
      </CardContent>
    </Card>
  );
}

function ScorecardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-h6 md:text-h4">Scorecard</h4>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }, (_, j) => (
                <div
                  key={j}
                  className="h-4 animate-pulse rounded bg-gray-100"
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ScorecardDisplay({ data }: { data: MatchDetailData }) {
  const resultText = buildResultText(data);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-h6 md:text-h4">Scorecard</h4>
        {resultText && (
          <span className="text-sm font-medium text-gray-600">
            {resultText}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.innings.map((inn) => (
          <InningsCard key={inn.inningsNumber} innings={inn} />
        ))}
      </div>
    </div>
  );
}

type ScorecardInnerProps = {
  matchId: string;
  when: string | null;
};

function ScorecardInner({ matchId, when }: ScorecardInnerProps) {
  const gameInPast = when ? isPast(new Date(when)) : false;

  const { data, isLoading } = useQuery({
    queryKey: ["getMatchDetail", matchId],
    queryFn: () => actions.playCricket.getMatchDetail({ matchId }),
    enabled: gameInPast,
    staleTime: 30 * 60 * 1000,
  });

  if (!gameInPast) return null;
  if (isLoading) return <ScorecardSkeleton />;

  const matchDetail = data?.data;
  if (!matchDetail || matchDetail.innings.length === 0) return null;

  return <ScorecardDisplay data={matchDetail} />;
}

const queryClient = new QueryClient();

type ScorecardProps = {
  matchId: string;
  when: string | null;
};

export function Scorecard(props: ScorecardProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ScorecardInner {...props} />
    </QueryClientProvider>
  );
}
