import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";

interface HighlightItemProps {
  label: string;
  title: string;
  detail: string;
  accent: string;
}

function HighlightItem({ label, title, detail, accent }: HighlightItemProps) {
  return (
    <div className={`rounded-lg border-l-4 ${accent} bg-gray-50 p-4`}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-lg font-bold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

export function GameweekHighlights() {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "gameweekHighlights"],
    queryFn: async () => {
      const res = await actions.fantasy.getGameweekHighlights({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.highlights) {
    return null;
  }

  const { highlights, gameweek } = data;
  const { topScorer, bestSpell, fantasyShock, topTeam, biggestMover, mostCaptained, differentialPick } = highlights;

  // Don't render if there's nothing to show
  if (!topScorer && !bestSpell && !topTeam) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Match Report</CardTitle>
          <Badge variant="secondary">Gameweek {gameweek}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {topScorer && (
            <HighlightItem
              label="Top Scorer"
              title={topScorer.playerName}
              detail={
                topScorer.battingRuns !== null
                  ? `${topScorer.battingRuns} runs (${topScorer.totalPoints} pts)`
                  : `${topScorer.totalPoints} pts`
              }
              accent="border-amber-500"
            />
          )}

          {bestSpell && (
            <HighlightItem
              label="Best Spell"
              title={bestSpell.playerName}
              detail={
                bestSpell.wickets !== null && bestSpell.runsConceded !== null
                  ? `${bestSpell.wickets}-${bestSpell.runsConceded} (${bestSpell.bowlingPoints} bowling pts)`
                  : `${bestSpell.bowlingPoints} bowling pts`
              }
              accent="border-green-600"
            />
          )}

          {fantasyShock && (
            <HighlightItem
              label="Fantasy Shock"
              title={fantasyShock.playerName}
              detail={`${fantasyShock.totalPoints} pts — owned by ${fantasyShock.ownershipPct}% of teams`}
              accent="border-red-500"
            />
          )}

          {topTeam && (
            <HighlightItem
              label="Top Team"
              title={topTeam.ownerName}
              detail={`${topTeam.totalPoints} pts this gameweek`}
              accent="border-blue-600"
            />
          )}

          {biggestMover && biggestMover.rankChange > 0 && (
            <HighlightItem
              label="Biggest Mover"
              title={biggestMover.ownerName}
              detail={`Up ${biggestMover.rankChange} ${biggestMover.rankChange === 1 ? "place" : "places"} to ${biggestMover.currentRank}${getOrdinalSuffix(biggestMover.currentRank)}`}
              accent="border-purple-600"
            />
          )}

          {mostCaptained && (
            <HighlightItem
              label="Most Captained"
              title={mostCaptained.playerName}
              detail={`Captained by ${mostCaptained.captainPct}% of teams`}
              accent="border-orange-500"
            />
          )}

          {differentialPick && (
            <HighlightItem
              label="Differential Pick"
              title={differentialPick.playerName}
              detail={`${differentialPick.totalPoints} pts — owned by only ${differentialPick.ownershipPct}% of teams`}
              accent="border-teal-500"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0] || "th";
}
