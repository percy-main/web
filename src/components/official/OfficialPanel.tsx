import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
};

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
  const [confirmingTeam, setConfirmingTeam] = useState(false);
  const [playerStatuses, setPlayerStatuses] = useState<
    Record<string, "playing" | "dropped_out" | "no_show">
  >({});
  const [payingPlayerId, setPayingPlayerId] = useState<string | null>(null);

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

  const confirmTeamMutation = useMutation({
    mutationFn: (input: {
      matchdayId: string;
      playerStatuses: Array<{
        matchdayPlayerId: string;
        status: "playing" | "dropped_out" | "no_show";
      }>;
    }) => actions.matchday.confirmTeam(input),
    onSuccess: () => {
      setConfirmingTeam(false);
      setPlayerStatuses({});
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (input: {
      matchdayPlayerId: string;
      paymentMethod: "cash" | "bank_transfer" | "card";
    }) => actions.matchday.markMatchFeePaid(input),
    onSuccess: () => {
      setPayingPlayerId(null);
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const finishMatchMutation = useMutation({
    mutationFn: () => actions.matchday.finishMatch({ matchdayId }),
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

  const handleStartConfirm = () => {
    // Initialize all players as "playing" by default
    const initial: Record<string, "playing" | "dropped_out" | "no_show"> = {};
    for (const p of players) {
      if (p.id) initial[p.id] = "playing";
    }
    setPlayerStatuses(initial);
    setConfirmingTeam(true);
  };

  const handleConfirm = () => {
    confirmTeamMutation.mutate({
      matchdayId,
      playerStatuses: Object.entries(playerStatuses).map(
        ([matchdayPlayerId, status]) => ({
          matchdayPlayerId,
          status,
        }),
      ),
    });
  };

  const statusColors: Record<string, string> = {
    selected: "bg-gray-100 text-gray-700",
    playing: "bg-green-100 text-green-800",
    dropped_out: "bg-yellow-100 text-yellow-800",
    no_show: "bg-red-100 text-red-800",
    replaced: "bg-orange-100 text-orange-800",
  };

  const statusLabels: Record<string, string> = {
    selected: "Selected",
    playing: "Playing",
    dropped_out: "Dropped Out",
    no_show: "No Show",
    replaced: "Replaced",
  };

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
              <span
                className={`ml-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  data.matchday.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : data.matchday.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {data.matchday.status}
              </span>
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
                <div className="flex gap-2">
                  {data.matchday.status === "pending" && !confirmingTeam && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddForm(!showAddForm)}
                      >
                        {showAddForm ? "Cancel" : "Add Player"}
                      </Button>
                      {players.length > 0 && (
                        <Button size="sm" onClick={handleStartConfirm}>
                          Confirm Team
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {players.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No players selected yet.
                </p>
              ) : confirmingTeam ? (
                /* Confirmation mode */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-600">
                    Set each player&apos;s status and confirm the team.
                  </p>
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{player.player_name}</p>
                        {player.member_category && (
                          <p className="text-xs capitalize text-gray-400">
                            {player.member_category}
                          </p>
                        )}
                      </div>
                      <Select
                        value={playerStatuses[player.id!] ?? "playing"}
                        onValueChange={(
                          value: "playing" | "dropped_out" | "no_show",
                        ) =>
                          setPlayerStatuses((prev) => ({
                            ...prev,
                            [player.id!]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="playing">Playing</SelectItem>
                          <SelectItem value="dropped_out">
                            Dropped Out
                          </SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConfirm}
                      disabled={confirmTeamMutation.isPending}
                    >
                      {confirmTeamMutation.isPending
                        ? "Confirming..."
                        : "Confirm Team"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmingTeam(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  {confirmTeamMutation.isError && (
                    <p className="text-sm text-red-600">
                      Failed to confirm team.
                    </p>
                  )}
                </div>
              ) : (
                /* Normal view - shows player list with statuses */
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
                          <div className="flex items-center gap-2">
                            {player.member_category && (
                              <span className="text-xs capitalize text-gray-400">
                                {player.member_category}
                              </span>
                            )}
                            {data.matchday.status !== "pending" && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColors[player.status] ?? ""}`}
                              >
                                {statusLabels[player.status] ?? player.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Match fee payment controls for confirmed matchdays */}
                        {data.matchday.status === "confirmed" &&
                          player.status === "playing" &&
                          player.charge_id && (
                            <>
                              {payingPlayerId === player.id ? (
                                <div className="flex items-center gap-1">
                                  {(
                                    ["cash", "bank_transfer", "card"] as const
                                  ).map((method) => (
                                    <Button
                                      key={method}
                                      size="sm"
                                      variant="outline"
                                      disabled={markPaidMutation.isPending}
                                      onClick={() =>
                                        markPaidMutation.mutate({
                                          matchdayPlayerId: player.id!,
                                          paymentMethod: method,
                                        })
                                      }
                                    >
                                      {PAYMENT_METHOD_LABELS[method]}
                                    </Button>
                                  ))}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setPayingPlayerId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPayingPlayerId(player.id!)
                                  }
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </>
                          )}
                        {/* Show paid status */}
                        {player.charge_id &&
                          data.matchday.status !== "pending" &&
                          player.status === "playing" &&
                          payingPlayerId !== player.id && (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                              Fee pending
                            </span>
                          )}
                        {/* Remove button for pending matchdays */}
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
                              <span className="font-medium">
                                {member.name}
                              </span>
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

          {markPaidMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to mark payment.
            </p>
          )}

          {/* Finish Match button for confirmed matchdays */}
          {data.matchday.status === "confirmed" && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Finish Match</p>
                    <p className="text-sm text-gray-500">
                      Unpaid match fees will remain as charges and notification
                      emails will be sent.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    disabled={finishMatchMutation.isPending}
                    onClick={() => finishMatchMutation.mutate()}
                  >
                    {finishMatchMutation.isPending
                      ? "Finishing..."
                      : "Finish Match"}
                  </Button>
                </div>
                {finishMatchMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">
                    Failed to finish match.
                  </p>
                )}
                {finishMatchMutation.isSuccess && (
                  <p className="mt-2 text-sm text-green-600">
                    Match finished. Notification emails sent for unpaid fees.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Finished status message */}
          {data.matchday.status === "finished" && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">
                  This match has been finished.
                  {data.matchday.finished_at &&
                    ` Completed on ${format(new Date(data.matchday.finished_at), "dd/MM/yyyy HH:mm")}.`}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
