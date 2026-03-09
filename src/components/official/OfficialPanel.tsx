import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";
import { parse, format } from "date-fns";
import { useState } from "react";

const queryClient = new QueryClient();

export function OfficialPanel() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!session.data) {
    void navigate("/auth/login");
    return null;
  }

  const role = session.data.user.role;
  if (role !== "official" && role !== "admin") {
    void navigate("/members");
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1>Match Official</h1>
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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | null>(
    null,
  );

  const teamsQuery = useQuery({
    queryKey: ["official", "myTeams"],
    queryFn: () => actions.matchday.listMyTeams(),
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
        No teams assigned. Contact an admin to be assigned as an official.
      </p>
    );
  }

  if (selectedMatchdayId) {
    return (
      <MatchdayView
        matchdayId={selectedMatchdayId}
        onBack={() => setSelectedMatchdayId(null)}
      />
    );
  }

  if (selectedTeamId) {
    return (
      <TeamMatchesView
        teamId={selectedTeamId}
        teamName={teams.find((t) => t.id === selectedTeamId)?.name ?? ""}
        onBack={() => setSelectedTeamId(null)}
        onSelectMatchday={(id) => setSelectedMatchdayId(id)}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <Card
          key={team.id}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => setSelectedTeamId(team.id)}
        >
          <CardHeader>
            <CardTitle className="text-lg">{team.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Click to view upcoming matches
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TeamMatchesView({
  teamId,
  teamName,
  onBack,
  onSelectMatchday,
}: {
  teamId: string;
  teamName: string;
  onBack: () => void;
  onSelectMatchday: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const matchesQuery = useQuery({
    queryKey: ["official", "upcomingMatches", teamId],
    queryFn: () => actions.matchday.getUpcomingMatches({ teamId }),
  });

  const createMatchdayMutation = useMutation({
    mutationFn: (input: {
      teamId: string;
      matchDate: string;
      opposition: string;
    }) => actions.matchday.createMatchday(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "upcomingMatches", teamId],
      });
      if (result.data?.id) {
        onSelectMatchday(result.data.id);
      }
    },
  });

  const matches = matchesQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <h2 className="text-xl font-semibold">{teamName}</h2>
      </div>

      {matchesQuery.isLoading && (
        <p className="text-gray-500">Loading matches...</p>
      )}
      {matchesQuery.isError && (
        <p className="text-red-600">Failed to load matches.</p>
      )}

      {matches.length === 0 && !matchesQuery.isLoading && (
        <p className="text-gray-500">No upcoming matches found.</p>
      )}

      <div className="grid gap-3">
        {matches.map((match) => {
          const matchDate = parse(match.matchDate, "dd/MM/yyyy", new Date());
          const isoDate = format(matchDate, "yyyy-MM-dd");

          return (
            <Card key={match.matchId}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {match.isHome ? "vs" : "@"} {match.opposition}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(matchDate, "EEEE d MMMM yyyy")}
                    {match.matchTime ? ` at ${match.matchTime}` : ""}
                  </p>
                  {match.competitionName && (
                    <p className="text-xs text-gray-400">
                      {match.competitionName}
                    </p>
                  )}
                </div>
                <div>
                  {match.matchdayId ? (
                    <Button
                      size="sm"
                      onClick={() => onSelectMatchday(match.matchdayId!)}
                    >
                      {match.matchdayStatus === "confirmed"
                        ? "View Confirmed"
                        : match.matchdayStatus === "finished"
                          ? "View Finished"
                          : "Edit Squad"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={createMatchdayMutation.isPending}
                      onClick={() =>
                        createMatchdayMutation.mutate({
                          teamId,
                          matchDate: isoDate,
                          opposition: match.opposition,
                        })
                      }
                    >
                      {createMatchdayMutation.isPending
                        ? "Creating..."
                        : "Select Team"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {createMatchdayMutation.isError && (
        <p className="text-sm text-red-600">Failed to create matchday.</p>
      )}
    </div>
  );
}

function MatchdayView({
  matchdayId,
  onBack,
}: {
  matchdayId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [adHocName, setAdHocName] = useState("");

  const matchdayQuery = useQuery({
    queryKey: ["official", "matchday", matchdayId],
    queryFn: () => actions.matchday.getMatchday({ matchdayId }),
  });

  const searchMembersQuery = useQuery({
    queryKey: ["official", "searchMembers", searchQuery],
    queryFn: () => actions.matchday.searchMembers({ query: searchQuery }),
    enabled: searchQuery.length >= 2,
  });

  const addPlayerMutation = useMutation({
    mutationFn: (input: {
      matchdayId: string;
      memberId?: string;
      playerName: string;
    }) => actions.matchday.addPlayer(input),
    onSuccess: () => {
      setSearchQuery("");
      setAdHocName("");
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: (matchdayPlayerId: string) =>
      actions.matchday.removePlayer({ matchdayPlayerId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const data = matchdayQuery.data?.data;
  const players = data?.players ?? [];
  const searchResults = searchMembersQuery.data?.data ?? [];
  const existingMemberIds = new Set(
    players.filter((p) => p.member_id).map((p) => p.member_id),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        {matchdayQuery.isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : data ? (
          <div>
            <h2 className="text-xl font-semibold">
              {data.team?.name} vs {data.matchday.opposition}
            </h2>
            <p className="text-sm text-gray-500">
              {format(
                new Date(data.matchday.match_date),
                "EEEE d MMMM yyyy",
              )}
            </p>
          </div>
        ) : null}
      </div>

      {matchdayQuery.isError && (
        <p className="text-red-600">Failed to load matchday.</p>
      )}

      {data && (
        <>
          {/* Current squad */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Squad ({players.length})</span>
                {data.matchday.status === "pending" && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    {showAddForm ? "Cancel" : "Add Player"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {players.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No players selected yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {players.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm font-medium text-gray-400">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium">{player.player_name}</p>
                          {player.member_category && (
                            <p className="text-xs capitalize text-gray-400">
                              {player.member_category}
                            </p>
                          )}
                        </div>
                      </div>
                      {data.matchday.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
                          disabled={removePlayerMutation.isPending}
                          onClick={() =>
                            removePlayerMutation.mutate(player.id!)
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add player form */}
          {showAddForm && data.matchday.status === "pending" && (
            <Card>
              <CardHeader>
                <CardTitle>Add Player</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Member search */}
                <div>
                  <Input
                    placeholder="Search members by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchMembersQuery.isLoading && (
                    <p className="mt-2 text-sm text-gray-500">Searching...</p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200">
                      {searchResults
                        .filter((m) => !existingMemberIds.has(m.id))
                        .map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                            disabled={addPlayerMutation.isPending}
                            onClick={() =>
                              addPlayerMutation.mutate({
                                matchdayId,
                                memberId: member.id,
                                playerName: member.name,
                              })
                            }
                          >
                            <div>
                              <span className="font-medium">{member.name}</span>
                              {member.member_category && (
                                <span className="ml-2 text-xs capitalize text-gray-400">
                                  {member.member_category}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              {member.email}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Ad-hoc player */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="mb-2 text-sm text-gray-600">
                    Or add a player not in the system:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Player name"
                      value={adHocName}
                      onChange={(e) => setAdHocName(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={
                        !adHocName.trim() || addPlayerMutation.isPending
                      }
                      onClick={() =>
                        addPlayerMutation.mutate({
                          matchdayId,
                          playerName: adHocName.trim(),
                        })
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {addPlayerMutation.isError && (
                  <p className="text-sm text-red-600">
                    Failed to add player.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
