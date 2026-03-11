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
    queryFn: () => actions.fantasy.getTeam({ teamId }),
  });

  const data = teamQuery.data?.data;

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
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.players.map((player) => (
              <TableRow key={player.playCricketId}>
                <TableCell className="font-medium">
                  {player.playerName}
                </TableCell>
                <TableCell>
                  {player.isCaptain && (
                    <Badge className="bg-amber-100 text-amber-800">
                      Captain (2x)
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
