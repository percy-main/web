import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/Table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import { type FC, useState } from "react";

const PAGE_SIZE = 20;

type Filter = "all" | "pending_payment" | "pending_approval" | "approved";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Sponsorship = {
  id: string | null;
  gameId: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorWebsite: string | null;
  sponsorLogoUrl: string | null;
  sponsorMessage: string | null;
  approved: boolean;
  displayName: string | null;
  amountPence: number;
  paidAt: string | null;
  createdAt: string;
  notes: string | null;
};

const SponsorshipRow: FC<{ sponsorship: Sponsorship }> = ({ sponsorship }) => {
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(sponsorship.notes ?? "");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayName, setDisplayName] = useState(
    sponsorship.displayName ?? "",
  );

  const sponsorshipId = sponsorship.id ?? "";

  const approveMutation = useMutation({
    mutationFn: () =>
      actions.sponsorship.approve({
        sponsorshipId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      actions.sponsorship.reject({
        sponsorshipId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { displayName?: string; notes?: string }) =>
      actions.sponsorship.update({
        sponsorshipId,
        ...data,
      }),
    onSuccess: () => {
      setEditingNotes(false);
      setEditingDisplayName(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
    },
  });

  const getStatusBadge = () => {
    if (!sponsorship.paidAt) {
      return <Badge variant="warning">Pending Payment</Badge>;
    }
    if (!sponsorship.approved) {
      return <Badge variant="info">Pending Approval</Badge>;
    }
    return <Badge variant="success">Approved</Badge>;
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sponsorship.gameId}</span>
          <a
            href={`/calendar/event/${sponsorship.gameId}`}
            className="text-xs text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View game
          </a>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sponsorship.sponsorName}</span>
          <span className="text-xs text-gray-500">
            {sponsorship.sponsorEmail}
          </span>
          {sponsorship.sponsorWebsite && (
            <a
              href={sponsorship.sponsorWebsite}
              className="text-xs text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {sponsorship.sponsorWebsite}
            </a>
          )}
          {sponsorship.sponsorLogoUrl && (
            <img
              src={sponsorship.sponsorLogoUrl}
              alt="Sponsor logo"
              className="mt-1 h-8 max-w-[80px] object-contain"
            />
          )}
        </div>
      </TableCell>
      <TableCell>
        {sponsorship.sponsorMessage && (
          <span className="text-sm italic">
            &ldquo;{sponsorship.sponsorMessage}&rdquo;
          </span>
        )}
      </TableCell>
      <TableCell>{currencyFormatter.format(sponsorship.amountPence / 100)}</TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell>
        {sponsorship.paidAt
          ? formatDate(sponsorship.paidAt, "dd/MM/yyyy")
          : "-"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {editingDisplayName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-32 rounded border px-1 py-0.5 text-xs"
                placeholder="Display name"
              />
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() =>
                  updateMutation.mutate({ displayName })
                }
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingDisplayName(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingDisplayName(true)}
              className="text-left text-xs text-blue-600 hover:underline"
            >
              {sponsorship.displayName ?? "Set display name"}
            </button>
          )}
          {editingNotes ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-32 rounded border px-1 py-0.5 text-xs"
                placeholder="Notes"
              />
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => updateMutation.mutate({ notes })}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingNotes(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-left text-xs text-blue-600 hover:underline"
            >
              {sponsorship.notes ?? "Add notes"}
            </button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {sponsorship.paidAt && !sponsorship.approved && (
            <Button
              variant="default"
              className="h-7 px-3 text-xs"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "..." : "Approve"}
            </Button>
          )}
          {sponsorship.approved && (
            <Button
              variant="outline"
              className="h-7 px-3 text-xs"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "..." : "Revoke"}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export function SponsorshipsTable() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "sponsorships", page, PAGE_SIZE, filter],
    queryFn: () =>
      actions.sponsorship.list({
        page,
        pageSize: PAGE_SIZE,
        filter: filter === "all" ? undefined : filter,
      }),
  });

  const result = data?.data;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

  const totalRevenue = result
    ? result.sponsorships
        .filter((s) => s.paidAt)
        .reduce((sum, s) => sum + s.amountPence, 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter:</label>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter);
              setPage(1);
            }}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        {result && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              {result.total} sponsorship{result.total !== 1 ? "s" : ""}
            </span>
            <span>Revenue: {currencyFormatter.format(totalRevenue / 100)}</span>
          </div>
        )}
      </div>

      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load sponsorships.</p>}

      {result && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.sponsorships.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-gray-500"
                  >
                    No sponsorships found.
                  </TableCell>
                </TableRow>
              )}
              {result.sponsorships.map((sponsorship) => (
                <SponsorshipRow
                  key={sponsorship.id}
                  sponsorship={sponsorship}
                />
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} sponsorship{result.total !== 1 ? "s" : ""} total
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
