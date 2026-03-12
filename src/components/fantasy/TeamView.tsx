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
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";

export function TeamView({ teamId }: { teamId: number }) {
  const teamQuery = useQuery({
    queryKey: ["fantasy", "team", teamId],
    queryFn: async () => {
      const result = await actions.fantasy.getTeam({ teamId });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const data = teamQuery.data;

  if (teamQuery.isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!data) {
    return <p className="text-gray-500">Team not found.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.team.ownerName}&apos;s Team</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-center">Slot</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-16 text-right">Owned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.players.map((player) => (
              <TableRow key={player.playCricketId}>
                <TableCell className="font-medium">
                  {player.playerName}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">
                    {player.slotType === "batting"
                      ? "🏏"
                      : player.slotType === "bowling"
                        ? "🎳"
                        : "🏏🎳"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {player.isCaptain && (
                      <Badge className="bg-amber-100 text-amber-800">C</Badge>
                    )}
                    {player.isWicketkeeper && (
                      <Badge className="bg-blue-100 text-blue-800">WK</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {player.ownershipPct > 0 ? `${player.ownershipPct}%` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
