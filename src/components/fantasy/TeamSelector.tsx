import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";

type SelectedPlayer = {
  playCricketId: string;
  playerName: string;
  isCaptain: boolean;
};

export function TeamSelector() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [hasLoadedTeam, setHasLoadedTeam] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [search]);

  const myTeamQuery = useQuery({
    queryKey: ["fantasy", "myTeam"],
    queryFn: () => actions.fantasy.getMyTeam({}),
  });

  const eligibleQuery = useQuery({
    queryKey: ["fantasy", "eligiblePlayers"],
    queryFn: () => actions.fantasy.getEligiblePlayers({}),
  });

  const saveMutation = useMutation({
    mutationFn: (players: Array<{ playCricketId: string; isCaptain: boolean }>) =>
      actions.fantasy.saveTeam({ players }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fantasy", "myTeam"] });
    },
  });

  // Load existing team into selection state
  const teamData = myTeamQuery.data?.data;
  useEffect(() => {
    if (teamData?.players && teamData.players.length > 0 && !hasLoadedTeam) {
      setSelectedPlayers(
        teamData.players.map((p) => ({
          playCricketId: p.playCricketId,
          playerName: p.playerName,
          isCaptain: p.isCaptain,
        })),
      );
      setHasLoadedTeam(true);
    }
  }, [teamData, hasLoadedTeam]);

  const eligibleData = eligibleQuery.data?.data;
  const eligiblePlayers = eligibleData?.players ?? [];
  const currentSeasonYear = eligibleData?.season ?? new Date().getFullYear().toString();
  const previousSeasonYear = eligibleData?.previousSeason ?? (Number(currentSeasonYear) - 1).toString();
  const transferWindowInfo = teamData?.transferWindowInfo;
  const locked = transferWindowInfo?.locked ?? false;
  const gameweek = teamData?.gameweek ?? 0;
  const preseason = transferWindowInfo?.isPreSeason ?? true;
  const transfersUsed = teamData?.transfersUsed ?? 0;
  const maxTransfers = teamData?.maxTransfers ?? null; // null = unlimited

  const selectedIds = new Set(selectedPlayers.map((p) => p.playCricketId));

  // Filter available players
  const availablePlayers = eligiblePlayers.filter((p) => {
    if (p.playCricketId && selectedIds.has(p.playCricketId)) return false;
    if (debouncedSearch) {
      return p.playerName
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase());
    }
    return true;
  });

  const handleAddPlayer = (playCricketId: string, playerName: string) => {
    if (selectedPlayers.length >= 11) return;
    setSelectedPlayers((prev) => [
      ...prev,
      {
        playCricketId,
        playerName,
        isCaptain: prev.length === 0, // First player is auto-captain
      },
    ]);
  };

  const handleRemovePlayer = (playCricketId: string) => {
    setSelectedPlayers((prev) => {
      const updated = prev.filter((p) => p.playCricketId !== playCricketId);
      // If we removed the captain, make the first player captain
      const first = updated[0];
      if (first && !updated.some((p) => p.isCaptain)) {
        first.isCaptain = true;
      }
      return [...updated];
    });
  };

  const handleSetCaptain = (playCricketId: string) => {
    setSelectedPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        isCaptain: p.playCricketId === playCricketId,
      })),
    );
  };

  const handleSave = () => {
    saveMutation.mutate(
      selectedPlayers.map((p) => ({
        playCricketId: p.playCricketId,
        isCaptain: p.isCaptain,
      })),
    );
  };

  // Check if team has changed from saved state
  const savedPlayerIds = new Set(
    teamData?.players?.map((p) => p.playCricketId) ?? [],
  );
  const savedCaptainId = teamData?.players?.find((p) => p.isCaptain)
    ?.playCricketId;
  const hasChanges =
    selectedPlayers.length === 11 &&
    (selectedPlayers.some((p) => !savedPlayerIds.has(p.playCricketId)) ||
      selectedPlayers.find((p) => p.isCaptain)?.playCricketId !==
        savedCaptainId);

  if (myTeamQuery.isLoading || eligibleQuery.isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm sm:gap-4">
          {preseason ? (
            <>
              <Badge variant="secondary">Pre-season</Badge>
              <span className="text-sm text-gray-600">
                Build your squad before the season starts
              </span>
              {transferWindowInfo?.daysUntilLock != null && transferWindowInfo.daysUntilLock > 0 && (
                <span className="text-sm text-gray-500">
                  Gameweek 1 starts in {transferWindowInfo.daysUntilLock} day{transferWindowInfo.daysUntilLock !== 1 ? "s" : ""}
                </span>
              )}
            </>
          ) : (
            <>
              <Badge variant={locked ? "destructive" : "default"}>
                {locked ? "Locked" : "Open"}
              </Badge>
              <span className="text-sm text-gray-600">
                Gameweek {gameweek}
              </span>
              {!locked && teamData?.team && maxTransfers !== null && (
                <span className="text-sm text-gray-600">
                  Transfers: {transfersUsed}/{maxTransfers} used
                </span>
              )}
              {locked && (
                <span className="text-sm text-gray-500">
                  Editing reopens Monday 00:00 UK time
                </span>
              )}
              {!locked && (
                <span className="text-sm text-gray-500">
                  Locks Friday 23:59 UK time
                </span>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected squad */}
      <Card>
        <CardHeader>
          <CardTitle>
            Your Squad ({selectedPlayers.length}/11)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPlayers.length === 0 ? (
            <p className="text-sm text-gray-500">
              Select 11 players from the list below to build your squad.
              Choose one captain whose points will be doubled.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPlayers.map((player) => (
                  <TableRow key={player.playCricketId}>
                    <TableCell className="font-medium">
                      {player.playerName}
                    </TableCell>
                    <TableCell>
                      {player.isCaptain ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          Captain (2x)
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={locked}
                          onClick={() =>
                            handleSetCaptain(player.playCricketId)
                          }
                        >
                          Make Captain
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        disabled={locked}
                        onClick={() =>
                          handleRemovePlayer(player.playCricketId)
                        }
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          {selectedPlayers.length === 11 && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={locked || saveMutation.isPending || !hasChanges}
              >
                {saveMutation.isPending ? "Saving..." : "Save Team"}
              </Button>
              {saveMutation.isSuccess && (
                <p className="text-sm text-green-600">Team saved!</p>
              )}
              {saveMutation.isError && (
                <p className="text-sm text-red-600">
                  {saveMutation.error?.message ?? "Failed to save team."}
                </p>
              )}
              {!hasChanges && !saveMutation.isSuccess && (
                <p className="text-sm text-gray-500">No changes to save.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player selection */}
      {!locked && selectedPlayers.length < 11 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Available Players</CardTitle>
              <Input
                className="w-full sm:w-64"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-gray-500">
                {debouncedSearch
                  ? "No players match your search."
                  : "No eligible players available."}
              </p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">
                      Pts ({currentSeasonYear})
                    </TableHead>
                    <TableHead className="text-right">
                      Avg ({currentSeasonYear})
                    </TableHead>
                    <TableHead className="text-right">
                      Pts ({previousSeasonYear})
                    </TableHead>
                    <TableHead className="text-right">
                      Avg ({previousSeasonYear})
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availablePlayers.map((player) => (
                    <TableRow key={player.playCricketId}>
                      <TableCell className="font-medium">
                        {player.playerName}
                      </TableCell>
                      <TableCell className="text-right">
                        {player.stats.current.matchesPlayed > 0 ? player.stats.current.totalPoints : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {player.stats.current.avgPoints ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {player.stats.previous.matchesPlayed > 0 ? player.stats.previous.totalPoints : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {player.stats.previous.avgPoints ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (player.playCricketId) {
                              handleAddPlayer(
                                player.playCricketId,
                                player.playerName,
                              );
                            }
                          }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show available players for transfers when squad is full */}
      {!locked && selectedPlayers.length === 11 && !hasChanges && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Make Transfers</CardTitle>
              <Input
                className="w-full sm:w-64"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-600">
              Remove a player from your squad above, then add a replacement here.
              {maxTransfers !== null
                ? ` You have ${maxTransfers - transfersUsed} transfer(s) remaining this gameweek.`
                : " Unlimited changes allowed."}
            </p>
            <p className="text-xs text-gray-400">
              Tip: Choose your captain wisely — their points are doubled.{" "}
              <a href="/fantasy/rules" className="text-blue-500 hover:underline">
                View scoring rules
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
