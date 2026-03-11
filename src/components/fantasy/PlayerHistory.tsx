import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";

interface Props {
  playCricketId: string;
  onBack?: () => void;
}

export function PlayerHistory({ playCricketId, onBack }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "playerHistory", playCricketId],
    queryFn: async () => {
      const res = await actions.fantasy.getPlayerHistory({ playCricketId });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading player history...</p>;
  }

  if (!data) {
    return <p className="text-sm text-gray-500">Player not found.</p>;
  }

  const totalPoints = data.gameweeks.reduce((sum, gw) => sum + gw.totalPoints, 0);
  const totalMatches = data.gameweeks.reduce((sum, gw) => sum + gw.matchCount, 0);

  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <Button
          variant="ghost"
          className="self-start text-sm text-gray-600"
          onClick={onBack}
        >
          &larr; Back
        </Button>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{data.playerName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total points: </span>
              <span className="font-semibold">{totalPoints}</span>
            </div>
            <div>
              <span className="text-gray-500">Matches: </span>
              <span className="font-semibold">{totalMatches}</span>
            </div>
            <div>
              <span className="text-gray-500">Avg per match: </span>
              <span className="font-semibold">
                {totalMatches > 0 ? Math.round((totalPoints / totalMatches) * 10) / 10 : 0}
              </span>
            </div>
          </div>

          {data.gameweeks.length === 0 ? (
            <p className="text-sm text-gray-500">No scores recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GW</TableHead>
                    <TableHead className="text-right">Bat</TableHead>
                    <TableHead className="text-right">Bowl</TableHead>
                    <TableHead className="text-right">Field</TableHead>
                    <TableHead className="text-right">Team</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Matches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.gameweeks.map((gw) => (
                    <TableRow key={gw.gameweek}>
                      <TableCell className="font-medium">GW {gw.gameweek}</TableCell>
                      <TableCell className="text-right">{gw.battingPoints}</TableCell>
                      <TableCell className="text-right">{gw.bowlingPoints}</TableCell>
                      <TableCell className="text-right">{gw.fieldingPoints}</TableCell>
                      <TableCell className="text-right">{gw.teamPoints}</TableCell>
                      <TableCell className="text-right font-semibold">{gw.totalPoints}</TableCell>
                      <TableCell className="text-right text-gray-500">{gw.matchCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
