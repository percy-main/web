import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

function truncateMessage(message: string, maxLength = 100): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + "...";
}

export function ContactSubmissionsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      "listContactSubmissions",
      page,
      PAGE_SIZE,
      debouncedSearch,
    ],
    queryFn: () =>
      actions.admin.listContactSubmissions({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
  });

  const result = data?.data;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

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
      {error && <p className="text-red-600">Failed to load submissions.</p>}

      {result && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {result.submissions.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No submissions found.
                    </td>
                  </tr>
                )}
                {result.submissions.map((submission) => {
                  const isExpanded = expandedId === submission.id;
                  return (
                    <tr
                      key={submission.id}
                      className="cursor-pointer border-b hover:bg-gray-50"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : submission.id)
                      }
                    >
                      <td className="px-4 py-3 font-medium">
                        {submission.name}
                      </td>
                      <td className="px-4 py-3">{submission.email}</td>
                      <td className="px-4 py-3">
                        {isExpanded ? (
                          <span className="whitespace-pre-wrap">
                            {submission.message}
                          </span>
                        ) : (
                          truncateMessage(submission.message)
                        )}
                      </td>
                      <td className="px-4 py-3">{submission.page}</td>
                      <td className="px-4 py-3">
                        {formatDate(submission.createdAt, "dd/MM/yyyy HH:mm")}
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
              {result.total} submission{result.total !== 1 ? "s" : ""} total
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
