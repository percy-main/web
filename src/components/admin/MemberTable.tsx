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
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load users.</p>}

      {result && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Membership Status</th>
                  <th className="px-4 py-3">Membership Type</th>
                  <th className="px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {result.users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
                {result.users.map((user) => {
                  const membershipStatus = getMembershipStatus(user.paidUntil);
                  return (
                    <tr
                      key={user.id}
                      className="cursor-pointer border-b hover:bg-gray-50"
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <StatusPill
                          variant={user.isMember ? "green" : "red"}
                        >
                          {user.isMember ? "Member" : "Not Member"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill variant={membershipStatus.variant}>
                          {membershipStatus.label}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const typeDisplay = getMembershipTypeDisplay(user.membershipType);
                          return (
                            <StatusPill variant={typeDisplay.variant}>
                              {typeDisplay.label}
                            </StatusPill>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          variant={
                            user.role === "admin" ? "blue" : "gray"
                          }
                        >
                          {user.role ?? "user"}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} user{result.total !== 1 ? "s" : ""} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
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
