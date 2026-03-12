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
import { Badge } from "@/components/ui/Badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState, useRef, useEffect } from "react";

export function FantasyPlayersTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const playersQuery = useQuery({
    queryKey: ["admin", "fantasyPlayers", debouncedSearch],
    queryFn: () =>
      actions.fantasy.listPlayers({
        search: debouncedSearch || undefined,
      }),
  });

  const populateMutation = useMutation({
    mutationFn: () => actions.fantasy.populatePlayers({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "fantasyPlayers"],
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { playCricketId: string; eligible: boolean }) =>
      actions.fantasy.toggleEligibility(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "fantasyPlayers"],
      });
    },
  });

  const sandwichCostsMutation = useMutation({
    mutationFn: () => actions.fantasy.calculateSandwichCosts({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "fantasyPlayers"],
      });
    },
  });

  const rawPlayers = playersQuery.data?.data?.players ?? [];
  const players = rawPlayers.filter(
    (p): p is typeof p & { play_cricket_id: string } => p.play_cricket_id !== null,
  );
  const eligibleCount = players.filter((p) => p.eligible === 1).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Fantasy Player Management</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => populateMutation.mutate()}
              disabled={populateMutation.isPending}
            >
              {populateMutation.isPending
                ? "Refreshing..."
                : "Refresh from Play Cricket"}
            </Button>
            <Button
              variant="outline"
              onClick={() => sandwichCostsMutation.mutate()}
              disabled={sandwichCostsMutation.isPending}
            >
              {sandwichCostsMutation.isPending
                ? "Calculating..."
                : "Calculate Sandwich Costs"}
            </Button>
            {populateMutation.data?.data && (
              <p className="text-sm text-gray-600">
                Found {populateMutation.data.data.total} players,{" "}
                {populateMutation.data.data.inserted} updated.
              </p>
            )}
            {populateMutation.isError && (
              <p className="text-sm text-red-600">
                Failed to refresh players.
              </p>
            )}
          </div>
          {sandwichCostsMutation.data?.data && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium">Sandwich costs calculated from {sandwichCostsMutation.data.data.season} season data</p>
              <p className="text-gray-600">
                {sandwichCostsMutation.data.data.totalPlayers} players ({sandwichCostsMutation.data.data.scoredPlayers} scored, {sandwichCostsMutation.data.data.unscoredPlayers} unscored).
                Budget: {sandwichCostsMutation.data.data.budget} sandwiches.
              </p>
              <p className="text-gray-500">
                Distribution: {Object.entries(sandwichCostsMutation.data.data.distribution).map(([cost, count]) => `${cost}🥪: ${count}`).join(", ")}
              </p>
            </div>
          )}
          {sandwichCostsMutation.isError && (
            <p className="text-sm text-red-600">
              Failed to calculate sandwich costs.
            </p>
          )}
          <p className="text-sm text-gray-600">
            Populate the player list from Play Cricket match data, then toggle
            eligibility for players who should be available in the fantasy game.
            Use &quot;Calculate Sandwich Costs&quot; to assign costs based on previous season performance.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Players{" "}
              {players.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({eligibleCount} eligible / {players.length} total)
                </span>
              )}
            </CardTitle>
            <Input
              className="w-64"
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {playersQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : players.length === 0 ? (
            <p className="text-sm text-gray-500">
              No players found. Click &quot;Refresh from Play Cricket&quot; to
              populate the player list.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Play Cricket ID</TableHead>
                  <TableHead className="text-center">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.play_cricket_id}>
                    <TableCell className="font-medium">
                      {player.player_name}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {player.play_cricket_id}
                    </TableCell>
                    <TableCell className="text-center">
                      {"🥪".repeat(player.sandwich_cost)}
                    </TableCell>
                    <TableCell>
                      {player.eligible === 1 ? (
                        <Badge className="bg-green-100 text-green-800">
                          Eligible
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Ineligible</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            playCricketId: player.play_cricket_id,
                            eligible: player.eligible !== 1,
                          })
                        }
                      >
                        {player.eligible === 1
                          ? "Mark Ineligible"
                          : "Mark Eligible"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
