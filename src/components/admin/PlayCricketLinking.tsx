import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusPill } from "./StatusPill";

/** Simple substring + token-match score. Returns 0..1 where 1 is a perfect match. */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (q.length === 0 || t.length === 0) return 0;
  if (q === t) return 1;

  // Exact substring match scores high
  if (t.includes(q)) return 0.8;
  if (q.includes(t)) return 0.7;

  // Token-based matching: check how many query tokens appear in the target
  const queryTokens = q.split(/\s+/);
  const targetTokens = t.split(/\s+/);
  let matchedTokens = 0;

  for (const qt of queryTokens) {
    for (const tt of targetTokens) {
      if (tt.includes(qt) || qt.includes(tt)) {
        matchedTokens++;
        break;
      }
    }
  }

  // Also check if tokens match in reverse (target tokens in query)
  let reverseMatchedTokens = 0;
  for (const tt of targetTokens) {
    for (const qt of queryTokens) {
      if (qt.includes(tt) || tt.includes(qt)) {
        reverseMatchedTokens++;
        break;
      }
    }
  }

  const forwardRatio = matchedTokens / queryTokens.length;
  const reverseRatio = reverseMatchedTokens / targetTokens.length;

  return Math.max(forwardRatio, reverseRatio) * 0.6;
}

type PlayCricketPlayer = {
  memberId: number;
  name: string;
};

type PersonRow = {
  id: string;
  name: string;
  playCricketId: string | null;
  parentName?: string;
  type: "member" | "dependent";
};

export function PlayCricketLinking() {
  const queryClient = useQueryClient();
  const [pcPlayers, setPcPlayers] = useState<PlayCricketPlayer[] | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [linkingPerson, setLinkingPerson] = useState<PersonRow | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showLinked, setShowLinked] = useState(true);
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [personTypeFilter, setPersonTypeFilter] = useState<
    "all" | "member" | "dependent"
  >("all");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  const { data: linkingData, isLoading, error } = useQuery({
    queryKey: ["admin", "playCricketLinking"],
    queryFn: () =>
      actions.playCricketAdmin.getPlayCricketLinking.orThrow(),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      actions.playCricketAdmin.refreshPlayCricketPlayers.orThrow(),
    onSuccess: (result) => {
      setPcPlayers(result.players);
    },
  });

  const linkMutation = useMutation({
    mutationFn: (params: {
      type: "member" | "dependent";
      id: string;
      playCricketId: string;
    }) => actions.playCricketAdmin.linkPlayCricketPlayer.orThrow(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "playCricketLinking"],
      });
      setLinkingPerson(null);
      setPlayerSearch("");
    },
  });

  const [pendingUnlinkId, setPendingUnlinkId] = useState<string | null>(null);

  const unlinkMutation = useMutation({
    mutationFn: (params: { type: "member" | "dependent"; id: string }) =>
      actions.playCricketAdmin.unlinkPlayCricketPlayer.orThrow(params),
    onSuccess: () => {
      setPendingUnlinkId(null);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "playCricketLinking"],
      });
    },
    onError: () => {
      setPendingUnlinkId(null);
    },
  });

  // Combine members and dependents into a single list
  const allPeople: PersonRow[] = useMemo(() => {
    if (!linkingData) return [];
    const members: PersonRow[] = linkingData.members.map((m) => ({
      id: m.id,
      name: m.name,
      playCricketId: m.playCricketId,
      type: "member" as const,
    }));
    const deps: PersonRow[] = linkingData.dependents.map((d) => ({
      id: d.id,
      name: d.name,
      parentName: d.parentName,
      playCricketId: d.playCricketId,
      type: "dependent" as const,
    }));
    return [...members, ...deps];
  }, [linkingData]);

  // Filter people based on search, linked status, and type
  const filteredPeople = useMemo(() => {
    return allPeople.filter((person) => {
      // Type filter
      if (personTypeFilter !== "all" && person.type !== personTypeFilter)
        return false;

      // Linked/unlinked filter
      if (!showLinked && person.playCricketId) return false;
      if (!showUnlinked && !person.playCricketId) return false;

      // Search filter
      if (debouncedSearch.trim().length > 0) {
        const term = debouncedSearch.toLowerCase();
        const nameMatch = person.name.toLowerCase().includes(term);
        const parentMatch =
          person.parentName?.toLowerCase().includes(term) ?? false;
        if (!nameMatch && !parentMatch) return false;
      }

      return true;
    });
  }, [allPeople, debouncedSearch, showLinked, showUnlinked, personTypeFilter]);

  // Compute counts
  const linkedMembers = allPeople.filter(
    (p) => p.type === "member" && p.playCricketId,
  ).length;
  const totalMembers = allPeople.filter((p) => p.type === "member").length;
  const linkedDependents = allPeople.filter(
    (p) => p.type === "dependent" && p.playCricketId,
  ).length;
  const totalDependents = allPeople.filter(
    (p) => p.type === "dependent",
  ).length;

  // Find suggested Play-Cricket player matches for the linking modal
  const suggestedPlayers = useMemo(() => {
    if (!linkingPerson || !pcPlayers) return [];
    const query =
      playerSearch.trim().length > 0 ? playerSearch : linkingPerson.name;

    return pcPlayers
      .map((player) => ({
        ...player,
        score: fuzzyScore(query, player.name),
      }))
      .filter((p) => {
        // If the user typed a specific search, also do a substring check
        if (playerSearch.trim().length > 0) {
          const term = playerSearch.toLowerCase().trim();
          return (
            p.name.toLowerCase().includes(term) ||
            p.memberId.toString().includes(term) ||
            p.score > 0.3
          );
        }
        return p.score > 0.2;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [linkingPerson, pcPlayers, playerSearch]);

  // Memoized lookup map for player names by Play-Cricket ID
  const playerNameById = useMemo(() => {
    if (!pcPlayers) return new Map<string, string>();
    return new Map(pcPlayers.map((p) => [p.memberId.toString(), p.name]));
  }, [pcPlayers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with stats and refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Members:</span>{" "}
            <span className="font-medium">
              {linkedMembers}/{totalMembers}
            </span>{" "}
            <span className="text-gray-400">linked</span>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Juniors:</span>{" "}
            <span className="font-medium">
              {linkedDependents}/{totalDependents}
            </span>{" "}
            <span className="text-gray-400">linked</span>
          </div>
          {pcPlayers && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-500">Play-Cricket players:</span>{" "}
              <span className="font-medium">{pcPlayers.length}</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          size="sm"
        >
          {refreshMutation.isPending
            ? "Fetching..."
            : pcPlayers
              ? "Refresh Players"
              : "Load Players from Play-Cricket"}
        </Button>
      </div>

      {refreshMutation.isError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Failed to fetch Play-Cricket players. Please try again.
        </div>
      )}

      {!pcPlayers && !refreshMutation.isPending && (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          Click &quot;Load Players from Play-Cricket&quot; to fetch the player
          list. This is required before you can link members.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showLinked}
              onChange={(e) => setShowLinked(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Linked
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showUnlinked}
              onChange={(e) => setShowUnlinked(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Unlinked
          </label>
        </div>
        <select
          value={personTypeFilter}
          onChange={(e) =>
            setPersonTypeFilter(
              e.target.value as "all" | "member" | "dependent",
            )
          }
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          <option value="member">Members only</option>
          <option value="dependent">Juniors only</option>
        </select>
      </div>

      {/* Table */}
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && (
        <p className="text-red-600">Failed to load linking data.</p>
      )}

      {linkingData && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Play-Cricket Status</th>
                <th className="px-4 py-3">Play-Cricket Player</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No matching people found.
                  </td>
                </tr>
              )}
              {filteredPeople.map((person) => {
                const pcName = person.playCricketId
                  ? (playerNameById.get(person.playCricketId) ?? null)
                  : null;
                return (
                  <tr key={`${person.type}-${person.id}`} className="border-b">
                    <td className="px-4 py-3">
                      <div className="font-medium">{person.name}</div>
                      {person.parentName && (
                        <div className="text-xs text-gray-500">
                          Parent: {person.parentName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        variant={
                          person.type === "member" ? "blue" : "green"
                        }
                      >
                        {person.type === "member" ? "Member" : "Junior"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        variant={person.playCricketId ? "green" : "gray"}
                      >
                        {person.playCricketId ? "Linked" : "Unlinked"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      {person.playCricketId ? (
                        <div>
                          <span className="font-mono text-xs text-gray-500">
                            #{person.playCricketId}
                          </span>
                          {pcName && (
                            <span className="ml-1 text-gray-700">
                              {pcName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {person.playCricketId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingUnlinkId(`${person.type}-${person.id}`);
                            unlinkMutation.mutate({
                              type: person.type,
                              id: person.id,
                            });
                          }}
                          disabled={pendingUnlinkId === `${person.type}-${person.id}`}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Unlink
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLinkingPerson(person);
                            setPlayerSearch("");
                          }}
                          disabled={!pcPlayers}
                          title={!pcPlayers ? "Load Play-Cricket players first" : undefined}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          Link
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Linking Modal */}
      {linkingPerson && pcPlayers && (
        <LinkingModal
          person={linkingPerson}
          suggestedPlayers={suggestedPlayers}
          playerSearch={playerSearch}
          onPlayerSearchChange={setPlayerSearch}
          onLink={(playCricketId) =>
            linkMutation.mutate({
              type: linkingPerson.type,
              id: linkingPerson.id,
              playCricketId,
            })
          }
          onClose={() => {
            setLinkingPerson(null);
            setPlayerSearch("");
          }}
          isLinking={linkMutation.isPending}
          linkError={linkMutation.isError}
        />
      )}
    </div>
  );
}

function LinkingModal({
  person,
  suggestedPlayers,
  playerSearch,
  onPlayerSearchChange,
  onLink,
  onClose,
  isLinking,
  linkError,
}: {
  person: PersonRow;
  suggestedPlayers: Array<PlayCricketPlayer & { score: number }>;
  playerSearch: string;
  onPlayerSearchChange: (value: string) => void;
  onLink: (playCricketId: string) => void;
  onClose: () => void;
  isLinking: boolean;
  linkError: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Link Play-Cricket Player</h2>
            <p className="text-sm text-gray-500">
              Linking{" "}
              <span className="font-medium text-gray-800">{person.name}</span>
              {person.parentName && (
                <span className="text-gray-400">
                  {" "}
                  (parent: {person.parentName})
                </span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        <Input
          type="text"
          placeholder="Search Play-Cricket players..."
          value={playerSearch}
          onChange={(e) => onPlayerSearchChange(e.target.value)}
          className="mb-4"
          autoFocus
        />

        {linkError && (
          <p className="mb-3 text-sm text-red-600">
            Failed to link player. Please try again.
          </p>
        )}

        <div className="flex flex-col gap-1">
          {suggestedPlayers.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">
              No matching players found. Try a different search.
            </p>
          )}
          {suggestedPlayers.map((player) => (
            <div
              key={player.memberId}
              className="flex items-center justify-between rounded px-3 py-2 hover:bg-gray-50"
            >
              <div>
                <span className="font-medium">{player.name}</span>
                <span className="ml-2 font-mono text-xs text-gray-400">
                  #{player.memberId}
                </span>
                {player.score >= 0.7 && (
                  <StatusPill variant="green">
                    Strong match
                  </StatusPill>
                )}
                {player.score >= 0.4 && player.score < 0.7 && (
                  <StatusPill variant="yellow">
                    Possible match
                  </StatusPill>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => onLink(player.memberId.toString())}
                disabled={isLinking}
              >
                {isLinking ? "Linking..." : "Link"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
