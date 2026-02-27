import { AGE_GROUPS, type AgeGroup } from "@/lib/util/ageGroup";
import { Badge } from "@/components/ui/Badge";
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
import { formatDate } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

type MembershipFilter = "all" | "paid" | "unpaid";
type SexFilter = "all" | "male" | "female";

interface Junior {
  id: string;
  name: string;
  sex: string;
  dob: string;
  registeredAt: string;
  parentName: string;
  parentEmail: string;
  parentTelephone: string;
  paidUntil: string | null;
  ageGroup: AgeGroup | null;
  teamName: string | null;
}

function isMembershipActive(paidUntil: string | null): boolean {
  if (!paidUntil) return false;
  return new Date(paidUntil) >= new Date();
}

/** Ordered list of all possible team keys for consistent display order. */
const TEAM_ORDER = AGE_GROUPS.flatMap((group) => [
  `${group} Boys`,
  `${group} Girls`,
]);

const PAGE_SIZE = 100;

export function JuniorsTable() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState<AgeGroup | "all">(
    "all",
  );
  const [sexFilter, setSexFilter] = useState<SexFilter>("all");
  const [membershipFilter, setMembershipFilter] =
    useState<MembershipFilter>("all");
  const [page, setPage] = useState(1);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "admin",
      "listJuniors",
      page,
      PAGE_SIZE,
      debouncedSearch,
      sexFilter,
      ageGroupFilter,
      membershipFilter,
    ],
    queryFn: () =>
      actions.admin.listJuniors({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        sex: sexFilter,
        ageGroup: ageGroupFilter,
        membershipStatus: membershipFilter,
      }),
  });

  const juniors = useMemo<Junior[]>(() => data?.data?.juniors ?? [], [data]);
  const total = data?.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const grouped = useMemo(() => {
    const groups = new Map<string, Junior[]>();

    for (const junior of juniors) {
      const key = junior.teamName ?? "Overage";
      const existing = groups.get(key);
      if (existing) {
        existing.push(junior);
      } else {
        groups.set(key, [junior]);
      }
    }

    // Sort teams according to the defined order
    const sorted = new Map<string, Junior[]>();
    for (const teamKey of TEAM_ORDER) {
      const members = groups.get(teamKey);
      if (members && members.length > 0) {
        sorted.set(teamKey, members);
      }
    }
    // Append overage players at the end
    const overage = groups.get("Overage");
    if (overage && overage.length > 0) {
      sorted.set("Overage", overage);
    }

    return sorted;
  }, [juniors]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by junior or parent name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={ageGroupFilter}
          onChange={(e) => {
            setAgeGroupFilter(e.target.value as AgeGroup | "all");
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Age Groups</option>
          {AGE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={sexFilter}
          onChange={(e) => {
            setSexFilter(e.target.value as SexFilter);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Genders</option>
          <option value="male">Boys</option>
          <option value="female">Girls</option>
        </select>
        <select
          value={membershipFilter}
          onChange={(e) => {
            setMembershipFilter(e.target.value as MembershipFilter);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Memberships</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-500">
        Showing {juniors.length} of {total} junior
        {total !== 1 ? "s" : ""}
      </p>

      {/* Loading / Error */}
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load juniors.</p>}

      {/* Grouped teams */}
      {!isLoading && !error && (
        <div className="flex flex-col gap-4">
          {grouped.size === 0 && (
            <p className="py-6 text-center text-gray-500">
              No juniors found matching the current filters.
            </p>
          )}
          {Array.from(grouped.entries()).map(([teamName, members]) => (
            <TeamCard key={teamName} teamName={teamName} members={members} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function TeamCard({
  teamName,
  members,
}: {
  teamName: string;
  members: Junior[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {teamName}
            <Badge variant="secondary">{members.length}</Badge>
          </CardTitle>
          <span className="text-sm text-gray-400">
            {expanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Membership</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((junior) => {
                const paid = isMembershipActive(junior.paidUntil);
                return (
                  <TableRow key={junior.id}>
                    <TableCell className="font-medium">
                      {junior.name}
                    </TableCell>
                    <TableCell>
                      {formatDate(junior.dob, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{junior.parentName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <a
                          href={`mailto:${junior.parentEmail}`}
                          className="text-blue-600 hover:underline"
                        >
                          {junior.parentEmail}
                        </a>
                        <span>{junior.parentTelephone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paid ? "success" : "destructive"}>
                        {paid ? "Paid" : "Unpaid"}
                      </Badge>
                      {junior.paidUntil && (
                        <span className="ml-1 text-xs text-gray-500">
                          until {formatDate(junior.paidUntil, "dd/MM/yyyy")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
