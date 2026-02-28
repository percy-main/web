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
      {error && <p className="text-red-600">Failed to load submissions.</p>}

      {result && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.submissions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-gray-500"
                  >
                    No submissions found.
                  </TableCell>
                </TableRow>
              )}
              {result.submissions.map((submission) => {
                const isExpanded = expandedId === submission.id;
                return (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : submission.id)
                    }
                  >
                    <TableCell className="font-medium">
                      {submission.name}
                    </TableCell>
                    <TableCell>{submission.email}</TableCell>
                    <TableCell>
                      {isExpanded ? (
                        <span className="whitespace-pre-wrap">
                          {submission.message}
                        </span>
                      ) : (
                        truncateMessage(submission.message)
                      )}
                    </TableCell>
                    <TableCell>{submission.page}</TableCell>
                    <TableCell>
                      {formatDate(submission.createdAt, "dd/MM/yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} submission{result.total !== 1 ? "s" : ""} total
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
