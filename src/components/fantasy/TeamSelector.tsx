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
import {
  SANDWICH_BUDGET,
  SLOT_COUNTS,
  type SlotType,
} from "@/lib/fantasy/scoring";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";

type SelectedPlayer = {
  playCricketId: string;
  playerName: string;
  sandwichCost: number;
  isCaptain: boolean;
  slotType: SlotType;
  isWicketkeeper: boolean;
};

const SLOT_LABELS: Record<SlotType, string> = {
  batting: "Batting",
  bowling: "Bowling",
  allrounder: "All-Rounder",
};

const SLOT_ICONS: Record<SlotType, string> = {
  batting: "🏏",
  bowling: "🎳",
  allrounder: "🏏🎳",
};

function SandwichCost({ cost }: { cost: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-sm" title={`Sandwich cost: ${cost}`}>
      {"🥪".repeat(cost)}
    </span>
  );
}

function BudgetTracker({ used, total }: { used: number; total: number }) {
  const percentage = Math.min((used / total) * 100, 100);
  const overBudget = used > total;

  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 w-32 rounded-full bg-gray-200">
        <div
          className={`h-2.5 rounded-full transition-all ${
            overBudget ? "bg-red-500" : percentage > 80 ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`text-sm font-medium ${overBudget ? "text-red-600" : ""}`}>
        {used}/{total} budget
      </span>
    </div>
  );
}

function SortablePlayerRow({
  player,
  locked,
  onRemove,
  onSetCaptain,
  onToggleWk,
}: {
  player: SelectedPlayer;
  locked: boolean;
  onRemove: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onToggleWk: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.playCricketId, disabled: locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8 cursor-grab" {...attributes} {...listeners}>
        <span className="text-gray-400">⠿</span>
      </TableCell>
      <TableCell className="font-medium">
        {player.playerName}
        <span className="ml-2">
          <SandwichCost cost={player.sandwichCost} />
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {player.isCaptain ? (
            <Badge className="bg-amber-100 text-amber-800">C</Badge>
          ) : player.slotType !== "allrounder" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onSetCaptain(player.playCricketId)}
              className="h-6 px-2 text-xs"
            >
              C
            </Button>
          ) : (
            <span className="inline-block w-6 text-center text-xs text-gray-400" title="All-rounder cannot be captain">
              -
            </span>
          )}
          {player.isWicketkeeper ? (
            <Badge className="bg-blue-100 text-blue-800">WK</Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onToggleWk(player.playCricketId)}
              className="h-6 px-2 text-xs"
            >
              WK
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-800"
            disabled={locked}
            onClick={() => onRemove(player.playCricketId)}
          >
            Remove
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SlotSection({
  slotType,
  players,
  locked,
  onRemove,
  onSetCaptain,
  onToggleWk,
}: {
  slotType: SlotType;
  players: SelectedPlayer[];
  locked: boolean;
  onRemove: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onToggleWk: (id: string) => void;
}) {
  const maxSlots = SLOT_COUNTS[slotType];
  const ids = players.map((p) => p.playCricketId);

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <span>{SLOT_ICONS[slotType]}</span>
        <h4 className="font-semibold">{SLOT_LABELS[slotType]}</h4>
        <Badge variant="outline" className="text-xs">
          {players.length}/{maxSlots}
        </Badge>
        <span className="text-xs text-gray-500">
          {slotType === "batting"
            ? "Bat + Field + Team pts"
            : slotType === "bowling"
              ? "Bowl + Field + Team pts"
              : "All pts"}
        </span>
      </div>
      {players.length > 0 && (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Table>
            <TableBody>
              {players.map((player) => (
                <SortablePlayerRow
                  key={player.playCricketId}
                  player={player}
                  locked={locked}
                  onRemove={onRemove}
                  onSetCaptain={onSetCaptain}
                  onToggleWk={onToggleWk}
                />
              ))}
            </TableBody>
          </Table>
        </SortableContext>
      )}
      {players.length < maxSlots && (
        <p className="mt-1 text-xs text-gray-400">
          {maxSlots - players.length} more slot{maxSlots - players.length !== 1 ? "s" : ""} to fill
        </p>
      )}
    </div>
  );
}

export function TeamSelector() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [hasLoadedTeam, setHasLoadedTeam] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const chipStatusQuery = useQuery({
    queryKey: ["fantasy", "chipStatus"],
    queryFn: () => actions.fantasy.getChipStatus({}),
  });

  const chipMutation = useMutation({
    mutationFn: async ({
      chipType,
      active,
    }: {
      chipType: string;
      active: boolean;
    }) => {
      const res = active
        ? await actions.fantasy.activateChip({ chipType: chipType as "triple_captain" })
        : await actions.fantasy.deactivateChip({ chipType: chipType as "triple_captain" });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["fantasy", "chipStatus"],
      });
    },
  });

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
    queryFn: async () => {
      const result = await actions.fantasy.getMyTeam({});
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const eligibleQuery = useQuery({
    queryKey: ["fantasy", "eligiblePlayers"],
    queryFn: async () => {
      const result = await actions.fantasy.getEligiblePlayers({});
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (
      players: Array<{
        playCricketId: string;
        isCaptain: boolean;
        slotType: SlotType;
        isWicketkeeper: boolean;
      }>,
    ) => {
      const res = await actions.fantasy.saveTeam({ players });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fantasy", "myTeam"] });
    },
  });

  // Load existing team into selection state
  const teamData = myTeamQuery.data;
  useEffect(() => {
    if (teamData?.players && teamData.players.length > 0 && !hasLoadedTeam) {
      setSelectedPlayers(
        teamData.players.map((p) => ({
          playCricketId: p.playCricketId,
          playerName: p.playerName,
          sandwichCost: p.sandwichCost,
          isCaptain: p.isCaptain,
          slotType: p.slotType,
          isWicketkeeper: p.isWicketkeeper,
        })),
      );
      setHasLoadedTeam(true);
    }
  }, [teamData, hasLoadedTeam]);

  const eligibleData = eligibleQuery.data;
  const eligiblePlayers = eligibleData?.players ?? [];
  const currentSeasonYear =
    eligibleData?.season ?? new Date().getFullYear().toString();
  const previousSeasonYear =
    eligibleData?.previousSeason ??
    (Number(currentSeasonYear) - 1).toString();
  const transferWindowInfo = teamData?.transferWindowInfo;
  const locked = transferWindowInfo?.locked ?? false;
  const gameweek = teamData?.gameweek ?? 0;
  const preseason = transferWindowInfo?.isPreSeason ?? true;
  const transfersUsed = teamData?.transfersUsed ?? 0;
  const maxTransfers = teamData?.maxTransfers ?? null;

  const selectedIds = new Set(selectedPlayers.map((p) => p.playCricketId));

  const budgetUsed = selectedPlayers.reduce((sum, p) => sum + p.sandwichCost, 0);
  const budgetRemaining = SANDWICH_BUDGET - budgetUsed;

  // Get next available slot type
  const getNextSlotType = (): SlotType | null => {
    const counts = { batting: 0, bowling: 0, allrounder: 0 };
    for (const p of selectedPlayers) counts[p.slotType]++;
    if (counts.batting < SLOT_COUNTS.batting) return "batting";
    if (counts.bowling < SLOT_COUNTS.bowling) return "bowling";
    if (counts.allrounder < SLOT_COUNTS.allrounder) return "allrounder";
    return null;
  };

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

  const handleAddPlayer = (
    playCricketId: string,
    playerName: string,
    sandwichCost: number,
  ) => {
    if (selectedPlayers.length >= 11) return;
    const slotType = getNextSlotType();
    if (!slotType) return;
    if (sandwichCost > budgetRemaining) return;

    setSelectedPlayers((prev) => [
      ...prev,
      {
        playCricketId,
        playerName,
        sandwichCost,
        isCaptain: prev.length === 0 && slotType !== "allrounder",
        slotType,
        isWicketkeeper: prev.length === 0,
      },
    ]);
  };

  const handleRemovePlayer = (playCricketId: string) => {
    setSelectedPlayers((prev) => {
      const updated = prev.filter((p) => p.playCricketId !== playCricketId);
      const needsCaptain = !updated.some((p) => p.isCaptain);
      const needsWk = !updated.some((p) => p.isWicketkeeper);
      const newCaptainId = needsCaptain
        ? (updated.find((p) => p.slotType !== "allrounder") ?? updated[0])?.playCricketId
        : null;
      const newWkId = needsWk ? updated[0]?.playCricketId : null;
      return updated.map((p) => ({
        ...p,
        isCaptain: newCaptainId === p.playCricketId ? true : p.isCaptain,
        isWicketkeeper: newWkId === p.playCricketId ? true : p.isWicketkeeper,
      }));
    });
  };

  const handleSetCaptain = (playCricketId: string) => {
    setSelectedPlayers((prev) => {
      const target = prev.find((p) => p.playCricketId === playCricketId);
      if (target?.slotType === "allrounder") return prev;
      return prev.map((p) => ({
        ...p,
        isCaptain: p.playCricketId === playCricketId,
      }));
    });
  };

  const handleToggleWk = (playCricketId: string) => {
    setSelectedPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        isWicketkeeper: p.playCricketId === playCricketId,
      })),
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSelectedPlayers((prev) => {
      const activePlayer = prev.find((p) => p.playCricketId === active.id);
      const overPlayer = prev.find((p) => p.playCricketId === over.id);
      if (!activePlayer || !overPlayer) return prev;

      // Swap slot types between dragged player and target
      if (activePlayer.slotType !== overPlayer.slotType) {
        const newSlotForActive = overPlayer.slotType;
        const newSlotForOver = activePlayer.slotType;

        return prev.map((p) => {
          if (p.playCricketId === active.id) {
            const updated = { ...p, slotType: newSlotForActive };
            // If moved to allrounder and was captain, remove captain
            if (newSlotForActive === "allrounder" && p.isCaptain) {
              updated.isCaptain = false;
            }
            return updated;
          }
          if (p.playCricketId === over.id) {
            const updated = { ...p, slotType: newSlotForOver };
            if (newSlotForOver === "allrounder" && p.isCaptain) {
              updated.isCaptain = false;
            }
            return updated;
          }
          return p;
        }).map((p, _i, arr) => {
          // Ensure there's still a captain after the swap
          if (!arr.some((x) => x.isCaptain)) {
            const first = arr.find((x) => x.slotType !== "allrounder");
            if (p.playCricketId === first?.playCricketId) {
              return { ...p, isCaptain: true };
            }
          }
          return p;
        });
      }

      // Same slot type: reorder within the section
      const activeIdx = prev.indexOf(activePlayer);
      const overIdx = prev.indexOf(overPlayer);
      const result = [...prev];
      result.splice(activeIdx, 1);
      result.splice(overIdx, 0, activePlayer);
      return result;
    });
  };

  const handleSave = () => {
    saveMutation.mutate(
      selectedPlayers.map((p) => ({
        playCricketId: p.playCricketId,
        isCaptain: p.isCaptain,
        slotType: p.slotType,
        isWicketkeeper: p.isWicketkeeper,
      })),
    );
  };

  // Check if team has changed from saved state
  const savedPlayers = teamData?.players ?? [];
  const hasChanges =
    selectedPlayers.length === 11 &&
    (selectedPlayers.some((p) => {
      const saved = savedPlayers.find((sp) => sp.playCricketId === p.playCricketId);
      if (!saved) return true;
      return (
        saved.isCaptain !== p.isCaptain ||
        saved.slotType !== p.slotType ||
        saved.isWicketkeeper !== p.isWicketkeeper
      );
    }) ||
      savedPlayers.some(
        (sp) => !selectedPlayers.find((p) => p.playCricketId === sp.playCricketId),
      ));

  // Validation state
  const slotCounts = { batting: 0, bowling: 0, allrounder: 0 };
  for (const p of selectedPlayers) slotCounts[p.slotType]++;
  const slotsValid =
    slotCounts.batting === SLOT_COUNTS.batting &&
    slotCounts.bowling === SLOT_COUNTS.bowling &&
    slotCounts.allrounder === SLOT_COUNTS.allrounder;
  const wkValid = selectedPlayers.filter((p) => p.isWicketkeeper).length === 1;
  const captainValid =
    selectedPlayers.filter((p) => p.isCaptain).length === 1 &&
    !selectedPlayers.find((p) => p.isCaptain && p.slotType === "allrounder");
  const budgetValid = budgetUsed <= SANDWICH_BUDGET;
  const canSave =
    selectedPlayers.length === 11 &&
    slotsValid &&
    wkValid &&
    captainValid &&
    budgetValid &&
    hasChanges &&
    !locked;

  if (myTeamQuery.isLoading || eligibleQuery.isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const battingPlayers = selectedPlayers.filter((p) => p.slotType === "batting");
  const bowlingPlayers = selectedPlayers.filter((p) => p.slotType === "bowling");
  const allrounderPlayers = selectedPlayers.filter((p) => p.slotType === "allrounder");

  const activePlayer = activeId
    ? selectedPlayers.find((p) => p.playCricketId === activeId)
    : null;

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
              {transferWindowInfo?.daysUntilLock != null &&
                transferWindowInfo.daysUntilLock > 0 && (
                  <span className="text-sm text-gray-500">
                    Gameweek 1 starts in {transferWindowInfo.daysUntilLock} day
                    {transferWindowInfo.daysUntilLock !== 1 ? "s" : ""}
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

      {/* Budget tracker */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Sandwich Budget</span>
            <BudgetTracker used={budgetUsed} total={SANDWICH_BUDGET} />
          </div>
          <span className="text-sm text-gray-500">
            {selectedPlayers.length}/11 players selected
          </span>
        </CardContent>
      </Card>

      {/* Selected squad with slot sections */}
      <Card>
        <CardHeader>
          <CardTitle>Your Squad</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPlayers.length === 0 ? (
            <p className="text-sm text-gray-500">
              Select 11 players from the list below. Assign them to batting (6),
              bowling (4), or all-rounder (1) slots. Choose one captain (2x
              points, cannot be all-rounder) and one wicketkeeper.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-3">
                <SlotSection
                  slotType="batting"
                  players={battingPlayers}
                  locked={locked}
                  onRemove={handleRemovePlayer}
                  onSetCaptain={handleSetCaptain}
                  onToggleWk={handleToggleWk}
                />
                <SlotSection
                  slotType="bowling"
                  players={bowlingPlayers}
                  locked={locked}
                  onRemove={handleRemovePlayer}
                  onSetCaptain={handleSetCaptain}
                  onToggleWk={handleToggleWk}
                />
                <SlotSection
                  slotType="allrounder"
                  players={allrounderPlayers}
                  locked={locked}
                  onRemove={handleRemovePlayer}
                  onSetCaptain={handleSetCaptain}
                  onToggleWk={handleToggleWk}
                />
              </div>
              <DragOverlay>
                {activePlayer ? (
                  <div className="rounded bg-white p-2 shadow-lg">
                    {activePlayer.playerName}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {selectedPlayers.length === 11 && (
            <div className="mt-4 flex flex-col gap-2">
              {!budgetValid && (
                <p className="text-sm text-red-600">
                  Over budget! Remove expensive players or swap for cheaper ones.
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={!canSave || saveMutation.isPending}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chips */}
      {teamData?.team && !preseason && !locked && (() => {
        const chipData = chipStatusQuery.data?.data;
        const tripleCaptain = chipData?.chips?.find(
          (c) => c.chipType === "triple_captain",
        );
        if (!tripleCaptain) return null;
        const remaining = tripleCaptain.maxPerSeason - tripleCaptain.usedThisSeason;
        const isActive = tripleCaptain.activeThisGameweek;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Chips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Triple Captain</span>
                    {isActive && (
                      <Badge className="bg-purple-100 text-purple-800">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Captain scores 3x instead of 2x.{" "}
                    {isActive
                      ? `${remaining} use${remaining !== 1 ? "s" : ""} remaining after this gameweek.`
                      : `${remaining} use${remaining !== 1 ? "s" : ""} remaining this season.`}
                  </p>
                </div>
                <Button
                  variant={isActive ? "destructive" : "outline"}
                  size="sm"
                  disabled={
                    chipMutation.isPending ||
                    (!isActive && remaining <= 0)
                  }
                  onClick={() =>
                    chipMutation.mutate({
                      chipType: "triple_captain",
                      active: !isActive,
                    })
                  }
                >
                  {chipMutation.isPending
                    ? "..."
                    : isActive
                      ? "Deactivate"
                      : "Activate"}
                </Button>
              </div>
              {chipMutation.isError && (
                <p className="mt-2 text-sm text-red-600">
                  {chipMutation.error?.message ?? "Failed to update chip."}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

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
            {(() => {
              const nextSlot = getNextSlotType();
              return nextSlot ? (
                <p className="mb-3 text-sm text-gray-600">
                  Adding to: <strong>{SLOT_LABELS[nextSlot]}</strong> slot
                  ({slotCounts[nextSlot]}/{SLOT_COUNTS[nextSlot]})
                </p>
              ) : null;
            })()}
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
                      <TableHead className="w-16 text-center">Cost</TableHead>
                      <TableHead className="text-right">
                        Pts ({currentSeasonYear})
                      </TableHead>
                      <TableHead className="text-right">
                        Avg ({currentSeasonYear})
                      </TableHead>
                      <TableHead className="text-right">
                        Pts ({previousSeasonYear})
                      </TableHead>
                      <TableHead className="w-16 text-right">Owned</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availablePlayers.map((player) => {
                      const overBudget = player.sandwichCost > budgetRemaining;
                      return (
                        <TableRow
                          key={player.playCricketId}
                          className={overBudget ? "opacity-50" : ""}
                        >
                          <TableCell className="font-medium">
                            {player.playerName}
                          </TableCell>
                          <TableCell className="text-center">
                            <SandwichCost cost={player.sandwichCost} />
                          </TableCell>
                          <TableCell className="text-right">
                            {player.stats.current.matchesPlayed > 0
                              ? player.stats.current.totalPoints
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {player.stats.current.avgPoints ?? "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {player.stats.previous.matchesPlayed > 0
                              ? player.stats.previous.totalPoints
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-gray-500">
                            {player.ownershipPct > 0 ? `${player.ownershipPct}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={overBudget}
                              onClick={() => {
                                if (player.playCricketId) {
                                  handleAddPlayer(
                                    player.playCricketId,
                                    player.playerName,
                                    player.sandwichCost,
                                  );
                                }
                              }}
                            >
                              {overBudget ? "Over budget" : "Add"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transfers info when squad is full */}
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
              Remove a player from your squad above, then add a replacement.
              Drag players between slots to reassign roles (free, doesn&apos;t
              count as a transfer).
              {maxTransfers !== null
                ? ` You have ${maxTransfers - transfersUsed} transfer(s) remaining this gameweek.`
                : " Unlimited changes allowed."}
            </p>
            <p className="text-xs text-gray-400">
              Tip: Choose your captain wisely — their points are doubled (or tripled with the Triple Captain chip!).
              All-rounders score all point categories but cannot be captain.{" "}
              <a
                href="/fantasy/rules"
                className="text-blue-500 hover:underline"
              >
                View scoring rules
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
