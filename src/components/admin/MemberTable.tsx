import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
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
import { useEffect, useRef, useState } from "react";
import { MemberDetailModal } from "./MemberDetailModal";
import { StatusPill, getMembershipStatus, getMembershipTypeDisplay } from "./StatusPill";

const PAGE_SIZE = 20;

export function MemberTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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
    queryKey: ["admin", "listUsers", page, PAGE_SIZE, debouncedSearch],
    queryFn: () =>
      actions.admin.listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
  });

  const result = data?.data;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load users.</p>}

      {result && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Membership Status</TableHead>
                <TableHead>Membership Type</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-gray-500"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
              {result.users.map((user) => {
                const membershipStatus = getMembershipStatus(user.paidUntil);
                const typeDisplay = getMembershipTypeDisplay(user.membershipType);
                return (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <StatusPill
                        variant={user.isMember ? "green" : "red"}
                      >
                        {user.isMember ? "Member" : "Not Member"}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill variant={membershipStatus.variant}>
                        {membershipStatus.label}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill variant={typeDisplay.variant}>
                        {typeDisplay.label}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        variant={
                          user.role === "admin" ? "blue" : "gray"
                        }
                      >
                        {user.role ?? "user"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} user{result.total !== 1 ? "s" : ""} total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedUserId && (
        <MemberDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
