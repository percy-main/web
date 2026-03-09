import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PAGE_SIZE = 20;

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPence(pence: number) {
  return currencyFormatter.format(pence / 100);
}

// Default to current financial year (April–March)
function getDefaultDateRange() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    dateFrom: `${year}-04-01`,
    dateTo: `${year + 1}-03-31`,
  };
}

const membershipTypeLabels: Record<string, string> = {
  senior_player: "Senior Player",
  social: "Social",
  concessionary: "Concessionary",
  senior_women_player: "Women's Player",
  junior: "Junior",
  unknown: "Unknown",
};

const CHART_COLORS: Record<string, string> = {
  membership: "#2563eb",
  sponsorship: "#16a34a",
  donation: "#f59e0b",
  manual: "#8b5cf6",
  other: "#6b7280",
};

export function TreasurerDashboard() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);

  return (
    <div className="flex flex-col gap-6">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Label htmlFor="treasurer-date-from" className="text-gray-500">
            From
          </Label>
          <Input
            id="treasurer-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex items-center gap-1">
          <Label htmlFor="treasurer-date-to" className="text-gray-500">
            To
          </Label>
          <Input
            id="treasurer-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = getDefaultDateRange();
            setDateFrom(d.dateFrom);
            setDateTo(d.dateTo);
          }}
        >
          Reset to current year
        </Button>
      </div>

      <SummaryCards dateFrom={dateFrom} dateTo={dateTo} />
      <IncomeChart dateFrom={dateFrom} dateTo={dateTo} />

      <div className="grid gap-6 lg:grid-cols-2">
        <MembershipSummary />
        <SponsorshipSummary dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      <MatchdayExpenses dateFrom={dateFrom} dateTo={dateTo} />
      <OutstandingPayments />
    </div>
  );
}

function SummaryCards({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  // Use the same income-by-month data as the chart so cards and chart are consistent
  const incomeQuery = useQuery({
    queryKey: ["treasurer", "incomeByMonth", dateFrom, dateTo],
    queryFn: () =>
      actions.treasurer.getIncomeByMonth({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const aggregatesQuery = useQuery({
    queryKey: ["treasurer", "chargeAggregates", dateFrom, dateTo],
    queryFn: () =>
      actions.admin.getChargeAggregates({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const expensesQuery = useQuery({
    queryKey: ["treasurer", "matchdayExpenses", dateFrom, dateTo],
    queryFn: () =>
      actions.treasurer.getMatchdayExpensesSummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const income = incomeQuery.data?.data;
  const aggregates = aggregatesQuery.data?.data;
  const expenses = expensesQuery.data?.data;

  if (incomeQuery.isError || aggregatesQuery.isError) {
    return <p className="text-red-600">Failed to load financial summary.</p>;
  }
  if (!income || !aggregates) {
    return <p className="text-gray-500">Loading summary...</p>;
  }

  // Sum across all months from the income-by-month data (same source as chart)
  const totals = income.reduce(
    (acc, month) => ({
      total: acc.total + month.membership + month.sponsorship + month.donation + month.manual + month.other,
      membership: acc.membership + month.membership,
      sponsorship: acc.sponsorship + month.sponsorship,
    }),
    { total: 0, membership: 0, sponsorship: 0 },
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <SummaryCard
        title="Total Income"
        amount={totals.total}
        variant="success"
      />
      <SummaryCard
        title="Outstanding"
        amount={aggregates.totalOutstanding}
        variant="warning"
      />
      <SummaryCard
        title="Membership"
        amount={totals.membership}
        variant="default"
      />
      <SummaryCard
        title="Sponsorship"
        amount={totals.sponsorship}
        variant="default"
      />
      <SummaryCard
        title="Matchday Expenses"
        amount={expenses?.total ?? 0}
        variant="destructive"
      />
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  subtitle,
  variant,
}: {
  title: string;
  amount: number;
  subtitle?: string;
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
        <div className="text-xl font-bold">{formatPence(amount)}</div>
        {subtitle && (
          <p className="text-xs text-gray-400">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function IncomeChart({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const query = useQuery({
    queryKey: ["treasurer", "incomeByMonth", dateFrom, dateTo],
    queryFn: () =>
      actions.treasurer.getIncomeByMonth({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const data = query.data?.data;

  if (query.isLoading) return <p className="text-gray-500">Loading chart...</p>;
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No income data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  // Convert pence to pounds for display
  const chartData = data.map((d) => ({
    month: d.month,
    Membership: d.membership / 100,
    Sponsorship: d.sponsorship / 100,
    Donation: d.donation / 100,
    Manual: d.manual / 100,
    Other: d.other / 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income by Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis
              tickFormatter={(v: number) =>
                currencyFormatter.format(v)
              }
            />
            <Tooltip
              formatter={(value) =>
                currencyFormatter.format(Number(value))
              }
            />
            <Legend />
            <Bar
              dataKey="Membership"
              stackId="a"
              fill={CHART_COLORS.membership}
            />
            <Bar
              dataKey="Sponsorship"
              stackId="a"
              fill={CHART_COLORS.sponsorship}
            />
            <Bar
              dataKey="Donation"
              stackId="a"
              fill={CHART_COLORS.donation}
            />
            <Bar
              dataKey="Manual"
              stackId="a"
              fill={CHART_COLORS.manual}
            />
            <Bar
              dataKey="Other"
              stackId="a"
              fill={CHART_COLORS.other}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function MembershipSummary() {
  const summaryQuery = useQuery({
    queryKey: ["treasurer", "membershipSummary"],
    queryFn: () => actions.treasurer.getMembershipSummary(),
  });

  const pricesQuery = useQuery({
    queryKey: ["treasurer", "membershipPrices"],
    queryFn: () => actions.treasurer.getMembershipPrices(),
  });

  const summary = summaryQuery.data?.data;
  const prices = pricesQuery.data?.data;

  if (summaryQuery.isLoading)
    return <p className="text-gray-500">Loading membership data...</p>;

  if (!summary || summary.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Membership Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No membership data.</p>
        </CardContent>
      </Card>
    );
  }

  const priceMap = new Map(prices?.map((p) => [p.type, p.annualPence]) ?? []);
  const totalActive = summary.reduce((s, r) => s + r.active, 0);
  const totalLapsed = summary.reduce((s, r) => s + r.lapsed, 0);
  const expectedRevenue = summary.reduce((s, r) => {
    const annual = priceMap.get(r.type) ?? 0;
    return s + r.active * annual;
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Lapsed</TableHead>
              <TableHead className="text-right">Annual Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((row) => (
              <TableRow key={row.type}>
                <TableCell>
                  {membershipTypeLabels[row.type] ?? row.type}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="success">{row.active}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={row.lapsed > 0 ? "warning" : "secondary"}>
                    {row.lapsed}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {priceMap.has(row.type)
                    ? formatPence(priceMap.get(row.type) ?? 0)
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{totalActive}</TableCell>
              <TableCell className="text-right">{totalLapsed}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {expectedRevenue > 0 && (
          <p className="text-sm text-gray-600">
            Expected annual membership revenue:{" "}
            <span className="font-semibold">{formatPence(expectedRevenue)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SponsorshipSummary({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const query = useQuery({
    queryKey: ["treasurer", "sponsorship", dateFrom, dateTo],
    queryFn: () =>
      actions.treasurer.getSponsorshipSummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const data = query.data?.data;

  if (query.isLoading)
    return <p className="text-gray-500">Loading sponsorship data...</p>;

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsorship Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Unpaid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Game Sponsorship</TableCell>
              <TableCell className="text-right">
                {formatPence(data.game.paidRevenue)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="success">{data.game.paidCount}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={data.game.unpaidCount > 0 ? "warning" : "secondary"}
                >
                  {data.game.unpaidCount}
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Player Sponsorship</TableCell>
              <TableCell className="text-right">
                {formatPence(data.player.paidRevenue)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="success">{data.player.paidCount}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    data.player.unpaidCount > 0 ? "warning" : "secondary"
                  }
                >
                  {data.player.unpaidCount}
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">
                {formatPence(
                  data.game.paidRevenue + data.player.paidRevenue,
                )}
              </TableCell>
              <TableCell className="text-right">
                {data.game.paidCount + data.player.paidCount}
              </TableCell>
              <TableCell className="text-right">
                {data.game.unpaidCount + data.player.unpaidCount}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MatchdayExpenses({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const query = useQuery({
    queryKey: ["treasurer", "matchdayExpenses", dateFrom, dateTo],
    queryFn: () =>
      actions.treasurer.getMatchdayExpensesSummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const data = query.data?.data;

  if (query.isLoading)
    return <p className="text-gray-500">Loading expenses...</p>;

  if (!data || data.byType.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matchday Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No matchday expenses for this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Matchday Expenses{" "}
          <span className="text-base font-normal text-gray-500">
            ({formatPence(data.total)} total)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byType.map((row) => (
              <TableRow key={row.type}>
                <TableCell className="capitalize">
                  {row.type.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-right">
                  {formatPence(row.total)}
                </TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OutstandingPayments() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [chasingChargeId, setChasingChargeId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["treasurer", "outstandingPayments", page, PAGE_SIZE],
    queryFn: () =>
      actions.treasurer.getOutstandingPayments({
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const chaseMutation = useMutation({
    mutationFn: (chargeId: string) =>
      actions.admin.chasePayment({ chargeId }),
    onSuccess: () => {
      setChasingChargeId(null);
      void queryClient.invalidateQueries({
        queryKey: ["treasurer", "outstandingPayments"],
      });
    },
  });

  const data = query.data?.data;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Outstanding Payments
          {data && (
            <span className="text-base font-normal text-gray-500">
              {" "}
              ({data.total} total)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading && (
          <p className="text-gray-500">Loading...</p>
        )}
        {query.isError && (
          <p className="text-red-600">Failed to load outstanding payments.</p>
        )}
        {data && (
          <>
            {data.charges.length === 0 ? (
              <p className="text-gray-500">No outstanding payments.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Days Overdue</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.charges.map((charge) => (
                    <TableRow key={charge.id}>
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
                      <TableCell>{charge.description}</TableCell>
                      <TableCell className="text-right">
                        {formatPence(charge.amountPence)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            charge.daysOverdue > 30
                              ? "destructive"
                              : charge.daysOverdue > 7
                                ? "warning"
                                : "default"
                          }
                        >
                          {charge.daysOverdue}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {chasingChargeId === charge.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={chaseMutation.isPending}
                              onClick={() => chaseMutation.mutate(charge.id)}
                            >
                              {chaseMutation.isPending ? "Sending..." : "Send"}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {data.total > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {data.total} payment{data.total !== 1 ? "s" : ""} total
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
