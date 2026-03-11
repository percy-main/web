import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useEffect, useState } from "react";

interface Props {
  teamId: number;
  availableGameweeks: number[];
  initialGameweek?: number;
  onViewPlayer?: (playCricketId: string) => void;
}

export function GameweekHistory({ teamId, availableGameweeks, initialGameweek, onViewPlayer }: Props) {
  const [gameweek, setGameweek] = useState<number>(
    initialGameweek ?? availableGameweeks[0] ?? 1,
  );

  // Sync selected gameweek when availableGameweeks loads asynchronously
  const firstAvailable = availableGameweeks[0];
  useEffect(() => {
    if (firstAvailable != null && gameweek === 1 && !availableGameweeks.includes(gameweek)) {
      setGameweek(firstAvailable);
    }
  }, [firstAvailable, gameweek, availableGameweeks]);

  const { data, isLoading } = useQuery({
    queryKey: ["fantasy", "gameweekDetail", teamId, gameweek],
    queryFn: async () => {
      const res = await actions.fantasy.getGameweekDetail({ gameweek, teamId });
      if (res.error) throw res.error;
      return res.data;
    },
    enabled: availableGameweeks.length > 0,
  });

  if (availableGameweeks.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-gray-500">No gameweek results available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Gameweek Results</CardTitle>
          <Select
            value={String(gameweek)}
            onValueChange={(val) => setGameweek(Number(val))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableGameweeks.map((gw) => (
                <SelectItem key={gw} value={String(gw)}>
                  GW {gw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !data ? (
          <p className="text-sm text-gray-500">No data for this gameweek.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-gray-600">Total team points:</span>
              <span className="text-lg font-bold">{data.team.totalPoints}</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="w-16 text-right">Bat</TableHead>
                    <TableHead className="w-16 text-right">Bowl</TableHead>
                    <TableHead className="w-16 text-right">Field</TableHead>
                    <TableHead className="w-16 text-right">Team</TableHead>
                    <TableHead className="w-20 text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.players
                    .sort((a, b) => b.effectivePoints - a.effectivePoints)
                    .map((player) => (
                      <TableRow key={player.playCricketId}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {onViewPlayer ? (
                              <Button
                                variant="link"
                                className="h-auto p-0 text-left font-medium"
                                onClick={() => onViewPlayer(player.playCricketId)}
                              >
                                {player.playerName}
                              </Button>
                            ) : (
                              player.playerName
                            )}
                            {player.isCaptain && (
                              <Badge className="bg-amber-100 text-amber-800">C</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {player.matchCount > 0 ? player.battingPoints : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.matchCount > 0 ? player.bowlingPoints : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.matchCount > 0 ? player.fieldingPoints : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.matchCount > 0 ? player.teamPoints : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {player.matchCount > 0 ? (
                            <span>
                              {player.effectivePoints}
                              {player.isCaptain && player.basePoints > 0 && (
                                <span className="ml-1 text-xs text-amber-600">
                                  ({player.basePoints}x2)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">DNP</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
