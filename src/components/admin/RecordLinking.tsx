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
  if (t.includes(q)) return 0.8;
  if (q.includes(t)) return 0.7;

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

type ContentfulPerson = {
  id: string;
  name: string;
  slug: string;
  photoUrl: string | null;
};

type PersonRow = {
  id: string;
  name: string;
  playCricketId: string | null;
  contentfulEntryId?: string | null;
  parentName?: string;
  type: "member" | "dependent";
};

type LinkTarget = "play-cricket" | "contentful";

type DetailModalState = {
  person: PersonRow;
  linking: LinkTarget | null;
};

export function RecordLinking() {
  const queryClient = useQueryClient();
  const [pcPlayers, setPcPlayers] = useState<PlayCricketPlayer[] | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
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
    queryKey: ["admin", "recordLinking"],
    queryFn: () => actions.recordLinking.getRecordLinking.orThrow(),
  });

  const contentfulQuery = useQuery({
    queryKey: ["admin", "contentfulPersons"],
    queryFn: () => actions.recordLinking.getContentfulPersons.orThrow(),
    staleTime: 10 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      actions.recordLinking.refreshPlayCricketPlayers.orThrow(),
    onSuccess: (result) => {
      setPcPlayers(result.players);
    },
  });

  const linkPcMutation = useMutation({
    mutationFn: (params: {
      type: "member" | "dependent";
      id: string;
      playCricketId: string;
    }) => actions.recordLinking.linkPlayCricketPlayer.orThrow(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "recordLinking"],
      });
      setDetailModal((prev) => (prev ? { ...prev, linking: null } : null));
      setLinkSearch("");
    },
  });

  const unlinkPcMutation = useMutation({
    mutationFn: (params: { type: "member" | "dependent"; id: string }) =>
      actions.recordLinking.unlinkPlayCricketPlayer.orThrow(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "recordLinking"],
      });
    },
  });

  const linkContentfulMutation = useMutation({
    mutationFn: (params: { memberId: string; contentfulEntryId: string }) =>
      actions.recordLinking.linkContentfulPerson.orThrow(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "recordLinking"],
      });
      setDetailModal((prev) => (prev ? { ...prev, linking: null } : null));
      setLinkSearch("");
    },
  });

  const unlinkContentfulMutation = useMutation({
    mutationFn: (params: { memberId: string }) =>
      actions.recordLinking.unlinkContentfulPerson.orThrow(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "recordLinking"],
      });
    },
  });

  // Build contentful person lookup map
  const contentfulPersonMap = useMemo(() => {
    if (!contentfulQuery.data) return new Map<string, ContentfulPerson>();
    return new Map(
      contentfulQuery.data.persons.map((p) => [
        p.id,
        { id: p.id, name: p.name, slug: p.slug, photoUrl: p.photoUrl },
      ]),
    );
  }, [contentfulQuery.data]);

  // Combine members and dependents into a single list
  const allPeople: PersonRow[] = useMemo(() => {
    if (!linkingData) return [];
    const members: PersonRow[] = linkingData.members.map((m) => ({
      id: m.id,
      name: m.name,
      playCricketId: m.playCricketId,
      contentfulEntryId: m.contentfulEntryId,
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

  // Filter people
  const filteredPeople = useMemo(() => {
    return allPeople.filter((person) => {
      if (personTypeFilter !== "all" && person.type !== personTypeFilter)
        return false;

      const isFullyLinked =
        person.type === "member"
          ? Boolean(person.playCricketId) && Boolean(person.contentfulEntryId)
          : Boolean(person.playCricketId);
      const isPartiallyLinked =
        person.type === "member"
          ? Boolean(person.playCricketId) || Boolean(person.contentfulEntryId)
          : Boolean(person.playCricketId);

      if (!showLinked && isFullyLinked) return false;
      if (!showUnlinked && !isPartiallyLinked) return false;

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

  // Stats
  const linkedPcMembers = allPeople.filter(
    (p) => p.type === "member" && p.playCricketId,
  ).length;
  const linkedContentful = allPeople.filter(
    (p) => p.type === "member" && p.contentfulEntryId,
  ).length;
  const totalMembers = allPeople.filter((p) => p.type === "member").length;
  const linkedPcDeps = allPeople.filter(
    (p) => p.type === "dependent" && p.playCricketId,
  ).length;
  const totalDependents = allPeople.filter(
    (p) => p.type === "dependent",
  ).length;

  // Player name lookup for PC IDs
  const playerNameById = useMemo(() => {
    if (!pcPlayers) return new Map<string, string>();
    return new Map(pcPlayers.map((p) => [p.memberId.toString(), p.name]));
  }, [pcPlayers]);

  // Keep detail modal person in sync with linkingData refreshes
  useEffect(() => {
    if (detailModal && linkingData) {
      const updated = allPeople.find(
        (p) => p.id === detailModal.person.id && p.type === detailModal.person.type,
      );
      if (updated) {
        setDetailModal((prev) =>
          prev ? { ...prev, person: updated } : null,
        );
      }
    }
  }, [allPeople]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      {/* Header stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Members:</span>{" "}
            <span className="font-medium">{totalMembers}</span>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Play-Cricket:</span>{" "}
            <span className="font-medium">
              {linkedPcMembers}/{totalMembers}
            </span>{" "}
            <span className="text-gray-400">members</span>
            {totalDependents > 0 && (
              <>
                {", "}
                <span className="font-medium">
                  {linkedPcDeps}/{totalDependents}
                </span>{" "}
                <span className="text-gray-400">juniors</span>
              </>
            )}
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-500">Contentful:</span>{" "}
            <span className="font-medium">
              {linkedContentful}/{totalMembers}
            </span>{" "}
            <span className="text-gray-400">linked</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            size="sm"
            variant="outline"
          >
            {refreshMutation.isPending
              ? "Fetching..."
              : pcPlayers
                ? "Refresh PC Players"
                : "Load PC Players"}
          </Button>
        </div>
      </div>

      {refreshMutation.isError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Failed to fetch Play-Cricket players. Please try again.
        </div>
      )}

      {!pcPlayers && !refreshMutation.isPending && (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          Click &quot;Load PC Players&quot; to fetch the Play-Cricket player
          list. This is needed to link Play-Cricket records.
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
            Fully linked
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
                <th className="px-4 py-3 text-center">Play-Cricket</th>
                <th className="px-4 py-3 text-center">Contentful</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No matching people found.
                  </td>
                </tr>
              )}
              {filteredPeople.map((person) => {
                const contentfulPerson = person.contentfulEntryId
                  ? contentfulPersonMap.get(person.contentfulEntryId)
                  : null;
                return (
                  <tr
                    key={`${person.type}-${person.id}`}
                    className="cursor-pointer border-b hover:bg-gray-50"
                    onClick={() =>
                      setDetailModal({ person, linking: null })
                    }
                  >
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
                    <td className="px-4 py-3 text-center">
                      {person.playCricketId ? (
                        <span
                          className="inline-block text-green-600"
                          title={`PC #${person.playCricketId}${playerNameById.get(person.playCricketId) ? ` - ${playerNameById.get(person.playCricketId)}` : ""}`}
                        >
                          <CheckIcon />
                        </span>
                      ) : (
                        <span className="inline-block text-gray-300">
                          <CrossIcon />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {person.type === "dependent" ? (
                        <span
                          className="inline-block text-gray-200"
                          title="Not applicable for juniors"
                        >
                          &mdash;
                        </span>
                      ) : person.contentfulEntryId ? (
                        <span
                          className="inline-block text-green-600"
                          title={contentfulPerson ? `${contentfulPerson.name} (/person/${contentfulPerson.slug})` : "Linked"}
                        >
                          <CheckIcon />
                        </span>
                      ) : (
                        <span className="inline-block text-gray-300">
                          <CrossIcon />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <DetailModal
          person={detailModal.person}
          linking={detailModal.linking}
          pcPlayers={pcPlayers}
          playerNameById={playerNameById}
          contentfulPersonMap={contentfulPersonMap}
          contentfulPersons={contentfulQuery.data?.persons ?? []}
          linkSearch={linkSearch}
          onLinkSearchChange={setLinkSearch}
          onStartLinking={(target) => {
            setDetailModal((prev) =>
              prev ? { ...prev, linking: target } : null,
            );
            setLinkSearch("");
          }}
          onCancelLinking={() => {
            setDetailModal((prev) =>
              prev ? { ...prev, linking: null } : null,
            );
            setLinkSearch("");
          }}
          onLinkPlayCricket={(playCricketId) =>
            linkPcMutation.mutate({
              type: detailModal.person.type,
              id: detailModal.person.id,
              playCricketId,
            })
          }
          onUnlinkPlayCricket={() =>
            unlinkPcMutation.mutate({
              type: detailModal.person.type,
              id: detailModal.person.id,
            })
          }
          onLinkContentful={(contentfulEntryId) =>
            linkContentfulMutation.mutate({
              memberId: detailModal.person.id,
              contentfulEntryId,
            })
          }
          onUnlinkContentful={() =>
            unlinkContentfulMutation.mutate({
              memberId: detailModal.person.id,
            })
          }
          isLinking={
            linkPcMutation.isPending || linkContentfulMutation.isPending
          }
          isUnlinking={
            unlinkPcMutation.isPending || unlinkContentfulMutation.isPending
          }
          onClose={() => {
            setDetailModal(null);
            setLinkSearch("");
          }}
        />
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="inline-block h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      className="inline-block h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function DetailModal({
  person,
  linking,
  pcPlayers,
  playerNameById,
  contentfulPersonMap,
  contentfulPersons,
  linkSearch,
  onLinkSearchChange,
  onStartLinking,
  onCancelLinking,
  onLinkPlayCricket,
  onUnlinkPlayCricket,
  onLinkContentful,
  onUnlinkContentful,
  isLinking,
  isUnlinking,
  onClose,
}: {
  person: PersonRow;
  linking: LinkTarget | null;
  pcPlayers: PlayCricketPlayer[] | null;
  playerNameById: Map<string, string>;
  contentfulPersonMap: Map<string, ContentfulPerson>;
  contentfulPersons: ContentfulPerson[];
  linkSearch: string;
  onLinkSearchChange: (value: string) => void;
  onStartLinking: (target: LinkTarget) => void;
  onCancelLinking: () => void;
  onLinkPlayCricket: (playCricketId: string) => void;
  onUnlinkPlayCricket: () => void;
  onLinkContentful: (contentfulEntryId: string) => void;
  onUnlinkContentful: () => void;
  isLinking: boolean;
  isUnlinking: boolean;
  onClose: () => void;
}) {
  const contentfulPerson = person.contentfulEntryId
    ? contentfulPersonMap.get(person.contentfulEntryId)
    : null;

  // Suggested PC players
  const suggestedPcPlayers = useMemo(() => {
    if (!pcPlayers || linking !== "play-cricket") return [];
    const query =
      linkSearch.trim().length > 0 ? linkSearch : person.name;
    return pcPlayers
      .map((player) => ({
        ...player,
        score: fuzzyScore(query, player.name),
      }))
      .filter((p) => {
        if (linkSearch.trim().length > 0) {
          const term = linkSearch.toLowerCase().trim();
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
  }, [pcPlayers, linking, linkSearch, person.name]);

  // Suggested Contentful persons
  const suggestedContentful = useMemo(() => {
    if (linking !== "contentful") return [];
    const query =
      linkSearch.trim().length > 0 ? linkSearch : person.name;
    return contentfulPersons
      .map((cp) => ({
        ...cp,
        score: fuzzyScore(query, cp.name),
      }))
      .filter((p) => {
        if (linkSearch.trim().length > 0) {
          const term = linkSearch.toLowerCase().trim();
          return (
            p.name.toLowerCase().includes(term) ||
            p.slug.toLowerCase().includes(term) ||
            p.score > 0.3
          );
        }
        return p.score > 0.2;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [contentfulPersons, linking, linkSearch, person.name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{person.name}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <StatusPill
                variant={person.type === "member" ? "blue" : "green"}
              >
                {person.type === "member" ? "Member" : "Junior"}
              </StatusPill>
              {person.parentName && (
                <span>Parent: {person.parentName}</span>
              )}
            </div>
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

        {/* Play-Cricket section */}
        <div className="mb-4 rounded border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Play-Cricket
          </h3>
          {person.playCricketId ? (
            <div className="flex items-center justify-between">
              <div>
                <StatusPill variant="green">Linked</StatusPill>
                <span className="ml-2 font-mono text-xs text-gray-500">
                  #{person.playCricketId}
                </span>
                {playerNameById.get(person.playCricketId) && (
                  <span className="ml-1 text-sm text-gray-700">
                    {playerNameById.get(person.playCricketId)}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onUnlinkPlayCricket}
                disabled={isUnlinking}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                Unlink
              </Button>
            </div>
          ) : linking === "play-cricket" ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search Play-Cricket players..."
                  value={linkSearch}
                  onChange={(e) => onLinkSearchChange(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelLinking}
                >
                  Cancel
                </Button>
              </div>
              {!pcPlayers && (
                <p className="text-sm text-yellow-600">
                  Load Play-Cricket players first using the button above.
                </p>
              )}
              <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                {suggestedPcPlayers.length === 0 && pcPlayers && (
                  <p className="py-2 text-center text-sm text-gray-500">
                    No matching players found.
                  </p>
                )}
                {suggestedPcPlayers.map((player) => (
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
                        <StatusPill variant="green">Strong match</StatusPill>
                      )}
                      {player.score >= 0.4 && player.score < 0.7 && (
                        <StatusPill variant="yellow">
                          Possible match
                        </StatusPill>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        onLinkPlayCricket(player.memberId.toString())
                      }
                      disabled={isLinking}
                    >
                      Link
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <StatusPill variant="gray">Not linked</StatusPill>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartLinking("play-cricket")}
                disabled={!pcPlayers}
                title={
                  !pcPlayers
                    ? "Load Play-Cricket players first"
                    : undefined
                }
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                Link
              </Button>
            </div>
          )}
        </div>

        {/* Contentful section - only for members */}
        {person.type === "member" && (
          <div className="rounded border border-gray-200 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Contentful Profile
            </h3>
            {person.contentfulEntryId && contentfulPerson ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {contentfulPerson.photoUrl && (
                    <img
                      src={contentfulPerson.photoUrl}
                      alt={contentfulPerson.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <StatusPill variant="green">Linked</StatusPill>
                    <span className="ml-2 text-sm font-medium">
                      {contentfulPerson.name}
                    </span>
                    <a
                      href={`/person/${contentfulPerson.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-blue-600 underline"
                    >
                      View profile
                    </a>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnlinkContentful}
                  disabled={isUnlinking}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Unlink
                </Button>
              </div>
            ) : person.contentfulEntryId && !contentfulPerson ? (
              <div className="flex items-center justify-between">
                <div>
                  <StatusPill variant="yellow">Linked (entry not found)</StatusPill>
                  <span className="ml-2 font-mono text-xs text-gray-400">
                    {person.contentfulEntryId}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnlinkContentful}
                  disabled={isUnlinking}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Unlink
                </Button>
              </div>
            ) : linking === "contentful" ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Search Contentful profiles..."
                    value={linkSearch}
                    onChange={(e) => onLinkSearchChange(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancelLinking}
                  >
                    Cancel
                  </Button>
                </div>
                {contentfulQuery.isLoading && (
                  <p className="text-sm text-gray-500">
                    Loading Contentful profiles...
                  </p>
                )}
                <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                  {suggestedContentful.length === 0 &&
                    !contentfulQuery.isLoading && (
                      <p className="py-2 text-center text-sm text-gray-500">
                        No matching profiles found.
                      </p>
                    )}
                  {suggestedContentful.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between rounded px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        {cp.photoUrl && (
                          <img
                            src={cp.photoUrl}
                            alt={cp.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <span className="font-medium">{cp.name}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            /person/{cp.slug}
                          </span>
                          {cp.score >= 0.7 && (
                            <StatusPill variant="green">
                              Strong match
                            </StatusPill>
                          )}
                          {cp.score >= 0.4 && cp.score < 0.7 && (
                            <StatusPill variant="yellow">
                              Possible match
                            </StatusPill>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onLinkContentful(cp.id)}
                        disabled={isLinking}
                      >
                        Link
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <StatusPill variant="gray">Not linked</StatusPill>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStartLinking("contentful")}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Link
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
