import { Badge } from "@/components/ui/Badge";
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
import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";
import { formatDate } from "date-fns";
import { useState } from "react";

const queryClient = new QueryClient();

export function JuniorManagerPanel() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!session.data) {
    void navigate("/auth/login");
    return null;
  }

  const role = session.data.user.role;
  if (role !== "junior_manager" && role !== "admin") {
    void navigate("/members");
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1>Junior Teams</h1>
          <div className="flex gap-2">
            {role === "admin" && (
              <a
                className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
                href="/admin"
              >
                Admin Panel
              </a>
            )}
            <a
              className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
              href="/members"
            >
              Members Area
            </a>
          </div>
        </div>
        <TeamsDashboard />
      </div>
    </QueryClientProvider>
  );
}

function TeamsDashboard() {
  const teamsQuery = useQuery({
    queryKey: ["juniorManager", "myTeams"],
    queryFn: () => actions.juniorManager.listMyTeams(),
  });

  if (teamsQuery.isLoading) {
    return <p className="text-gray-500">Loading teams...</p>;
  }

  if (teamsQuery.isError) {
    return <p className="text-red-600">Failed to load teams.</p>;
  }

  const teams = teamsQuery.data?.data ?? [];

  if (teams.length === 0) {
    return (
      <p className="text-gray-500">
        You have not been assigned to any teams. Contact an admin to get access.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        You have access to {teams.length} team{teams.length !== 1 ? "s" : ""}.
        Select a team to view players.
      </p>
      {teams.map((team) => (
        <TeamCard key={team.id} teamId={team.id ?? ""} teamName={team.name} />
      ))}
    </div>
  );
}

interface Player {
  id: string;
  name: string;
  sex: string;
  dob: string;
  registeredAt: string;
  parentName: string;
  parentEmail: string;
  parentTelephone: string;
  parentAddress: string;
  parentPostcode: string;
  emergencyContactName: string;
  emergencyContactTelephone: string;
}

function TeamCard({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const playersQuery = useQuery({
    queryKey: ["juniorManager", "players", teamId],
    queryFn: () => actions.juniorManager.listPlayers({ teamId }),
    enabled: expanded,
  });

  const players: Player[] = playersQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {teamName}
            {playersQuery.data && (
              <Badge variant="secondary">{players.length}</Badge>
            )}
          </CardTitle>
          <span className="text-sm text-gray-400">
            {expanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {playersQuery.isLoading && (
            <p className="text-sm text-gray-500">Loading players...</p>
          )}
          {playersQuery.isError && (
            <p className="text-sm text-red-600">Failed to load players.</p>
          )}
          {playersQuery.isSuccess && players.length === 0 && (
            <p className="text-sm text-gray-500">
              No players registered in this team.
            </p>
          )}
          {players.length > 0 && <PlayersTable players={players} />}
        </CardContent>
      )}
    </Card>
  );
}

function PlayersTable({ players }: { players: Player[] }) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>DOB</TableHead>
          <TableHead>Parent</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((player) => (
          <>
            <TableRow key={player.id}>
              <TableCell className="font-medium">{player.name}</TableCell>
              <TableCell>{formatDate(player.dob, "dd/MM/yyyy")}</TableCell>
              <TableCell>{player.parentName}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5 text-xs">
                  <a
                    href={`mailto:${player.parentEmail}`}
                    className="text-blue-600 hover:underline"
                  >
                    {player.parentEmail}
                  </a>
                  <span>{player.parentTelephone}</span>
                </div>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setExpandedPlayer(
                      expandedPlayer === player.id ? null : player.id,
                    )
                  }
                >
                  {expandedPlayer === player.id ? "Hide" : "View"}
                </Button>
              </TableCell>
            </TableRow>
            {expandedPlayer === player.id && (
              <TableRow key={`${player.id}-detail`}>
                <TableCell colSpan={5}>
                  <div className="rounded bg-gray-50 p-4">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="font-medium text-gray-500">
                        Player Name
                      </dt>
                      <dd>{player.name}</dd>
                      <dt className="font-medium text-gray-500">
                        Date of Birth
                      </dt>
                      <dd>{formatDate(player.dob, "dd/MM/yyyy")}</dd>
                      <dt className="font-medium text-gray-500">Sex</dt>
                      <dd className="capitalize">{player.sex}</dd>
                      <dt className="font-medium text-gray-500">
                        Registered
                      </dt>
                      <dd>
                        {formatDate(player.registeredAt, "dd/MM/yyyy")}
                      </dd>
                      <dt className="mt-3 font-medium text-gray-500">
                        Parent / Guardian
                      </dt>
                      <dd className="mt-3">{player.parentName}</dd>
                      <dt className="font-medium text-gray-500">Email</dt>
                      <dd>
                        <a
                          href={`mailto:${player.parentEmail}`}
                          className="text-blue-600 hover:underline"
                        >
                          {player.parentEmail}
                        </a>
                      </dd>
                      <dt className="font-medium text-gray-500">
                        Telephone
                      </dt>
                      <dd>{player.parentTelephone}</dd>
                      <dt className="font-medium text-gray-500">Address</dt>
                      <dd>
                        {player.parentAddress}
                        {player.parentPostcode && (
                          <>, {player.parentPostcode}</>
                        )}
                      </dd>
                      <dt className="mt-3 font-medium text-gray-500">
                        Emergency Contact
                      </dt>
                      <dd className="mt-3">
                        {player.emergencyContactName}
                      </dd>
                      <dt className="font-medium text-gray-500">
                        Emergency Phone
                      </dt>
                      <dd>{player.emergencyContactTelephone}</dd>
                    </dl>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
