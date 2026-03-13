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
import { compressImage } from "@/lib/image-utils";
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
import { useRef, useState } from "react";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  umpire_fee: "Umpire Fee",
  scorer_fee: "Scorer Fee",
  match_ball: "Match Ball",
  teas: "Teas",
  miscellaneous: "Miscellaneous",
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

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
    queryFn: async () => {
      const result = await actions.matchday.listMyTeams();
      if (result.error) throw result.error;
      return result.data;
    },
  });

  if (teamsQuery.isLoading) {
    return <p className="text-gray-500">Loading teams...</p>;
  }

  if (teamsQuery.isError) {
    return <p className="text-red-600">Failed to load teams.</p>;
  }

  const teams = teamsQuery.data ?? [];

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
    queryFn: async () => {
      const result = await actions.matchday.getUpcomingMatches({ teamId });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const createMatchdayMutation = useMutation({
    mutationFn: async (input: {
      teamId: string;
      matchDate: string;
      opposition: string;
      competitionType?: string;
      playCricketMatchId?: string;
    }) => {
      const result = await actions.matchday.createMatchday(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "upcomingMatches", teamId],
      });
      if (data?.id) {
        onSelectMatchday(data.id);
      }
    },
  });

  const matches = matchesQuery.data ?? [];

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
                  {(match.competitionName ?? match.competitionType) && (
                    <p className="text-xs text-gray-400">
                      {match.competitionType && (
                        <span className="mr-1 rounded bg-gray-100 px-1 py-0.5 font-medium text-gray-600">
                          {match.competitionType}
                        </span>
                      )}
                      {match.competitionName}
                    </p>
                  )}
                </div>
                <div>
                  {match.matchdayId ? (
                    <Button
                      size="sm"
                      onClick={() => onSelectMatchday(match.matchdayId ?? "")}
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
                          competitionType:
                            match.competitionType ?? undefined,
                          playCricketMatchId: match.matchId,
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
    queryFn: async () => {
      const result = await actions.matchday.getMatchday({ matchdayId });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const searchMembersQuery = useQuery({
    queryKey: ["official", "searchMembers", searchQuery],
    queryFn: async () => {
      const result = await actions.matchday.searchMembers({ query: searchQuery });
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: searchQuery.length >= 2,
  });

  const addPlayerMutation = useMutation({
    mutationFn: async (input: {
      matchdayId: string;
      memberId?: string;
      playerName: string;
    }) => {
      const result = await actions.matchday.addPlayer(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      setSearchQuery("");
      setAdHocName("");
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: async (matchdayPlayerId: string) => {
      const result = await actions.matchday.removePlayer({ matchdayPlayerId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const confirmTeamMutation = useMutation({
    mutationFn: async (input: {
      matchdayId: string;
      playerStatuses: Array<{
        matchdayPlayerId: string;
        status: "playing" | "dropped_out" | "no_show";
      }>;
    }) => {
      const result = await actions.matchday.confirmTeam(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      setConfirmingTeam(false);
      setPlayerStatuses({});
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (input: {
      matchdayPlayerId: string;
      paymentMethod: "cash" | "bank_transfer" | "card";
    }) => {
      const result = await actions.matchday.markMatchFeePaid(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      setPayingPlayerId(null);
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const finishMatchMutation = useMutation({
    mutationFn: async () => {
      const result = await actions.matchday.finishMatch({ matchdayId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (input: {
      matchdayId: string;
      expenseType: "umpire_fee" | "scorer_fee" | "match_ball" | "teas" | "miscellaneous";
      description?: string;
      amountPence: number;
      receiptImage?: string;
    }) => {
      const result = await actions.matchday.addExpense(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const result = await actions.matchday.deleteExpense({ expenseId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["official", "matchday", matchdayId],
      });
    },
  });

  const data = matchdayQuery.data;
  const players = (data?.players ?? []).filter(
    (p): p is typeof p & { id: string } => p.id !== null,
  );
  const searchResults = searchMembersQuery.data ?? [];
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
                        value={playerStatuses[player.id] ?? "playing"}
                        onValueChange={(
                          value: "playing" | "dropped_out" | "no_show",
                        ) =>
                          setPlayerStatuses((prev) => ({
                            ...prev,
                            [player.id]: value,
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
                          player.charge_id &&
                          !player.chargePaidAt && (
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
                                          matchdayPlayerId: player.id,
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
                                    setPayingPlayerId(player.id)
                                  }
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </>
                          )}
                        {/* Show fee status */}
                        {data.matchday.status !== "pending" &&
                          player.status === "playing" &&
                          payingPlayerId !== player.id &&
                          (player.chargePaidAt ? (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                              Fee paid
                            </span>
                          ) : player.charge_id ? (
                            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                              Fee pending
                            </span>
                          ) : (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                              No fee set
                            </span>
                          ))}
                        {/* Remove button for pending matchdays */}
                        {data.matchday.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800"
                            disabled={removePlayerMutation.isPending}
                            onClick={() =>
                              removePlayerMutation.mutate(player.id)
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
                                playerName: member.name ?? "Unknown",
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

          {/* Expenses section - visible for confirmed and finished matchdays */}
          {data.matchday.status !== "pending" && (
            <ExpensesSection
              matchdayId={matchdayId}
              expenses={data.expenses ?? []}
              isFinished={data.matchday.status === "finished"}
              addExpenseMutation={addExpenseMutation}
              deleteExpenseMutation={deleteExpenseMutation}
            />
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

type ExpenseType = "umpire_fee" | "scorer_fee" | "match_ball" | "teas" | "miscellaneous";

function ExpensesSection({
  matchdayId,
  expenses,
  isFinished,
  addExpenseMutation,
  deleteExpenseMutation,
}: {
  matchdayId: string;
  expenses: Array<{
    id: string | null;
    expense_type: string;
    description: string | null;
    amount_pence: number;
    created_at: string;
    receipt_image_url: string | null;
  }>;
  isFinished: boolean;
  addExpenseMutation: ReturnType<typeof useMutation<unknown, Error, {
    matchdayId: string;
    expenseType: ExpenseType;
    description?: string;
    amountPence: number;
    receiptImage?: string;
  }>>;
  deleteExpenseMutation: ReturnType<typeof useMutation<unknown, Error, string>>;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseType>("umpire_fee");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [matchBallUsed, setMatchBallUsed] = useState(true);
  const [matchBallCost, setMatchBallCost] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_pence, 0);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setMatchBallCost("");
    setMatchBallUsed(true);
    setReceiptPreview(null);
    setReceiptDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReceiptCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const dataUrl = await compressImage(file, {
        maxDimension: 1200,
        maxBytes: 400_000,
      });
      setReceiptPreview(dataUrl);
      setReceiptDataUrl(dataUrl);
    } catch {
      alert("Failed to process image. Please try a smaller image.");
    } finally {
      setCompressing(false);
    }
  };

  const handleExpenseTypeChange = (newType: ExpenseType) => {
    setExpenseType(newType);
    resetForm();
  };

  const handleAddExpense = () => {
    if (expenseType === "match_ball") {
      if (!matchBallUsed) return;
      const amountPence = Math.round(parseFloat(matchBallCost || "0") * 100);
      if (amountPence <= 0) return;
      addExpenseMutation.mutate(
        {
          matchdayId,
          expenseType: "match_ball",
          description: "New match ball",
          amountPence,
          receiptImage: receiptDataUrl ?? undefined,
        },
        {
          onSuccess: () => {
            resetForm();
            setShowAddForm(false);
          },
        },
      );
      return;
    }

    const amountPence = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountPence) || amountPence < 0) return;

    addExpenseMutation.mutate(
      {
        matchdayId,
        expenseType,
        description: description.trim() || undefined,
        amountPence,
        receiptImage: receiptDataUrl ?? undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          setShowAddForm(false);
        },
      },
    );
  };

  const hasMatchBall = expenses.some((e) => e.expense_type === "match_ball");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            Expenses
            {totalExpenses > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (Total: {currencyFormatter.format(totalExpenses / 100)})
              </span>
            )}
          </span>
          {!isFinished && !showAddForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(true)}
            >
              Add Expense
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Existing expenses */}
        {expenses.length === 0 ? (
          <p className="text-sm text-gray-500">No expenses recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {expenses.map((expense) => {
              const expenseId = expense.id;
              if (!expenseId) return null;
              return (
                <div
                  key={expenseId}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {EXPENSE_TYPE_LABELS[expense.expense_type] ??
                          expense.expense_type}
                      </p>
                      {expense.description && (
                        <p className="text-xs text-gray-500">
                          {expense.description}
                        </p>
                      )}
                    </div>
                    {expense.receipt_image_url && (
                      <button
                        type="button"
                        className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        onClick={() =>
                          setViewingReceipt(expense.receipt_image_url)
                        }
                      >
                        Receipt
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {currencyFormatter.format(expense.amount_pence / 100)}
                    </span>
                    {!isFinished && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        disabled={deleteExpenseMutation.isPending}
                        onClick={() =>
                          deleteExpenseMutation.mutate(expenseId)
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add expense form */}
        {showAddForm && (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Expense Type
                </label>
                <Select
                  value={expenseType}
                  onValueChange={(v: ExpenseType) => handleExpenseTypeChange(v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="umpire_fee">Umpire Fee</SelectItem>
                    <SelectItem value="scorer_fee">Scorer Fee</SelectItem>
                    {!hasMatchBall && (
                      <SelectItem value="match_ball">Match Ball</SelectItem>
                    )}
                    <SelectItem value="teas">Teas</SelectItem>
                    <SelectItem value="miscellaneous">Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {expenseType === "match_ball" ? (
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={matchBallUsed}
                      onChange={(e) => setMatchBallUsed(e.target.checked)}
                      className="rounded"
                    />
                    New match ball used
                  </label>
                  {matchBallUsed && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Cost
                      </label>
                      <Input
                        className="w-32"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={matchBallCost}
                        onChange={(e) => setMatchBallCost(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {expenseType === "umpire_fee"
                        ? "Umpire Name"
                        : expenseType === "scorer_fee"
                          ? "Scorer Name"
                          : expenseType === "miscellaneous"
                            ? "Description"
                            : "Description (optional)"}
                    </label>
                    <Input
                      placeholder={
                        expenseType === "umpire_fee"
                          ? "e.g. J. Smith"
                          : expenseType === "scorer_fee"
                            ? "e.g. A. Jones"
                            : "Description"
                      }
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Amount
                    </label>
                    <Input
                      className="w-32"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Receipt image capture */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Receipt Photo (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptCapture}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
                {compressing && (
                  <p className="mt-1 text-xs text-gray-500">
                    Processing image...
                  </p>
                )}
                {receiptPreview && (
                  <div className="mt-2">
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="h-24 w-auto rounded border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      className="mt-1 text-xs text-red-600 hover:underline"
                      onClick={() => {
                        setReceiptPreview(null);
                        setReceiptDataUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddExpense}
                  disabled={
                    addExpenseMutation.isPending ||
                    compressing ||
                    (expenseType === "match_ball"
                      ? !matchBallUsed
                      : !amount)
                  }
                >
                  {addExpenseMutation.isPending ? "Adding..." : "Add"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>

              {addExpenseMutation.isError && (
                <p className="text-sm text-red-600">
                  Failed to add expense.
                </p>
              )}
            </div>
          </div>
        )}

        {deleteExpenseMutation.isError && (
          <p className="mt-2 text-sm text-red-600">
            Failed to remove expense.
          </p>
        )}

        {/* Receipt image lightbox */}
        {viewingReceipt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setViewingReceipt(null)}
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={viewingReceipt}
                alt="Receipt"
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
              />
              <button
                type="button"
                className="absolute -top-3 -right-3 rounded-full bg-white p-1.5 text-gray-800 shadow hover:bg-gray-100"
                onClick={() => setViewingReceipt(null)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
