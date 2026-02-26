import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

type ChargeStatus = "all" | "unpaid" | "pending" | "paid" | "abandoned";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const statusBadgeMap: Record<
  string,
  { variant: "success" | "warning" | "info" | "destructive" | "default" | "secondary"; label: string }
> = {
  paid: { variant: "success", label: "Paid" },
  unpaid: { variant: "warning", label: "Unpaid" },
  pending: { variant: "info", label: "Pending" },
  abandoned: { variant: "destructive", label: "Abandoned" },
  deleted: { variant: "secondary", label: "Deleted" },
};

export function ChargesTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ChargeStatus>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chasingChargeId, setChasingChargeId] = useState<string | null>(null);
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

  const chargesQuery = useQuery({
    queryKey: [
      "admin",
      "listAllCharges",
      page,
      PAGE_SIZE,
      status,
      showDeleted,
      dateFrom,
      dateTo,
      debouncedSearch,
    ],
    queryFn: () =>
      actions.admin.listAllCharges({
        page,
        pageSize: PAGE_SIZE,
        status,
        showDeleted,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: debouncedSearch || undefined,
      }),
  });

  const aggregatesQuery = useQuery({
    queryKey: ["admin", "chargeAggregates", dateFrom, dateTo],
    queryFn: () =>
      actions.admin.getChargeAggregates({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const chaseMutation = useMutation({
    mutationFn: (chargeId: string) =>
      actions.admin.chasePayment({ chargeId }),
    onSuccess: () => {
      setChasingChargeId(null);
    },
  });

  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
    details?: {
      totalProcessed: number;
      created: number;
      skippedDuplicate: number;
      skippedSelfService: number;
      skippedNoMember: number;
      skippedFailed: number;
      membershipsSynced: number;
      errors: string[];
    };
  } | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () => actions.admin.syncStripeHistory(),
    onSuccess: (res) => {
      setShowSyncConfirm(false);

      // Astro actions return { data, error } — ActionErrors resolve (not reject)
      if (res.error) {
        setSyncResult({
          type: "error",
          message: res.error.message ?? "Failed to sync Stripe history",
        });
        return;
      }

      if (res.data) {
        const d = res.data;
        setSyncResult({
          type: "success",
          message: `Sync complete: ${d.created} new charges imported, ${d.skippedDuplicate} duplicates skipped, ${d.skippedSelfService} self-service excluded, ${d.membershipsSynced} memberships updated, ${d.totalProcessed} total processed.`,
          details: d,
        });

        // Refresh charges list and aggregates
        void queryClient.invalidateQueries({
          queryKey: ["admin", "listAllCharges"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["admin", "chargeAggregates"],
        });
      }
    },
    onError: (err) => {
      setShowSyncConfirm(false);
      setSyncResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to sync Stripe history",
      });
    },
  });

  const result = chargesQuery.data?.data;
  const aggregates = aggregatesQuery.data?.data;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Cards */}
      {aggregates && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            title="Total Charged"
            amount={aggregates.totalCharged}
            count={
              aggregates.countPaid +
              aggregates.countUnpaid +
              aggregates.countPending +
              aggregates.countAbandoned
            }
            variant="default"
          />
          <SummaryCard
            title="Collected"
            amount={aggregates.totalPaid}
            count={aggregates.countPaid}
            variant="success"
          />
          <SummaryCard
            title="Outstanding"
            amount={aggregates.totalOutstanding}
            count={
              aggregates.countUnpaid +
              aggregates.countPending +
              aggregates.countAbandoned
            }
            variant="warning"
          />
          <SummaryCard
            title="Abandoned"
            amount={aggregates.totalAbandoned}
            count={aggregates.countAbandoned}
            variant="destructive"
          />
        </div>
      )}

      {/* Sync Stripe History */}
      <div className="flex items-center gap-3">
        {showSyncConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Sync all historical Stripe charges? This may take a while.
            </span>
            <Button
              variant="default"
              size="sm"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? "Syncing..." : "Confirm"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={syncMutation.isPending}
              onClick={() => setShowSyncConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSyncConfirm(true)}
          >
            Sync Stripe History
          </Button>
        )}
      </div>

      {syncResult && (
        <Alert variant={syncResult.type === "error" ? "destructive" : "default"}>
          <AlertTitle>
            {syncResult.type === "error" ? "Sync Failed" : "Sync Complete"}
          </AlertTitle>
          <AlertDescription>
            <p>{syncResult.message}</p>
            {syncResult.details && syncResult.details.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-4">
                {syncResult.details.errors.map((error, i) => (
                  <li key={i} className="text-xs">
                    {error}
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-auto p-0 text-xs text-gray-500 underline hover:text-gray-700"
              onClick={() => setSyncResult(null)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search member or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ChargeStatus);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <div className="flex items-center gap-1">
          <label htmlFor="charges-date-from" className="text-sm text-gray-500">
            From
          </label>
          <input
            id="charges-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor="charges-date-to" className="text-sm text-gray-500">
            To
          </label>
          <input
            id="charges-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => {
              setShowDeleted(e.target.checked);
              setPage(1);
            }}
            className="rounded border-gray-300"
          />
          Show deleted
        </label>
        {(dateFrom || dateTo || search || status !== "all" || showDeleted) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setStatus("all");
              setDateFrom("");
              setDateTo("");
              setShowDeleted(false);
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Loading / Error */}
      {chargesQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {chargesQuery.isError && (
        <p className="text-red-600">Failed to load charges.</p>
      )}

      {/* Table */}
      {result && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.charges.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-gray-500"
                  >
                    No charges found.
                  </TableCell>
                </TableRow>
              )}
              {result.charges.map((charge) => {
                const badge = statusBadgeMap[charge.status];
                return (
                  <TableRow
                    key={charge.id}
                    className={
                      charge.status === "deleted" ? "opacity-60" : ""
                    }
                  >
                    <TableCell>
                      {formatDate(charge.chargeDate, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {charge.memberName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {charge.memberEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {charge.description}
                      {charge.deletedReason && (
                        <div className="text-xs text-gray-400">
                          Deleted: {charge.deletedReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {currencyFormatter.format(charge.amountPence / 100)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{charge.source}</Badge>
                    </TableCell>
                    <TableCell>
                      {badge && (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {charge.paidAt
                        ? formatDate(charge.paidAt, "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {(charge.status === "abandoned" ||
                        charge.status === "unpaid") && (
                        <>
                          {chasingChargeId === charge.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={chaseMutation.isPending}
                                onClick={() =>
                                  chaseMutation.mutate(charge.id, {
                                    onSuccess: () => {
                                      void queryClient.invalidateQueries({
                                        queryKey: [
                                          "admin",
                                          "listAllCharges",
                                        ],
                                      });
                                    },
                                  })
                                }
                              >
                                {chaseMutation.isPending
                                  ? "Sending..."
                                  : "Send"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setChasingChargeId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChasingChargeId(charge.id)}
                            >
                              Chase
                            </Button>
                          )}
                          {chaseMutation.isError &&
                            chasingChargeId === charge.id && (
                              <p className="mt-1 text-xs text-red-600">
                                Failed to send reminder.
                              </p>
                            )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} charge{result.total !== 1 ? "s" : ""} total
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
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  count,
  variant,
}: {
  title: string;
  amount: number;
  count: number;
  variant: "default" | "success" | "warning" | "destructive";
}) {
  const borderColorMap: Record<string, string> = {
    default: "",
    success: "border-l-green-500",
    warning: "border-l-yellow-500",
    destructive: "border-l-red-500",
  };

  return (
    <Card className={`border-l-4 ${borderColorMap[variant]}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">
          {currencyFormatter.format(amount / 100)}
        </div>
        <p className="text-xs text-gray-500">
          {count} charge{count !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
