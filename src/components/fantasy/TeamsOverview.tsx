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
import { useState } from "react";
import { TeamView } from "./TeamView";

export function TeamsOverview() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const teamsQuery = useQuery({
    queryKey: ["fantasy", "allTeams"],
    queryFn: () => actions.fantasy.listTeams({}),
  });

  const teams = teamsQuery.data?.data?.teams ?? [];

  if (teamsQuery.isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (selectedTeamId !== null) {
    return (
      <div className="flex flex-col gap-4">
        <button
          className="text-sm text-gray-600 hover:underline self-start"
          onClick={() => setSelectedTeamId(null)}
        >
          &larr; Back to all teams
        </button>
        <TeamView teamId={selectedTeamId} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          All Teams ({teams.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-sm text-gray-500">
            No teams have been created yet for this season.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manager</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">
                    {team.ownerName}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {new Date(team.createdAt).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => setSelectedTeamId(team.id!)}
                    >
                      View Team
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
