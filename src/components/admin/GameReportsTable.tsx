import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
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
import { format } from "date-fns";
import { useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  umpire_fee: "Umpire Fee",
  scorer_fee: "Scorer Fee",
  match_ball: "Match Ball",
  teas: "Teas",
  miscellaneous: "Miscellaneous",
};

export function GameReportsTable() {
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | null>(
    null,
  );

  const teamsQuery = useQuery({
    queryKey: ["admin", "playCricketTeams"],
    queryFn: () => actions.playCricket.getTeams(),
  });

  const matchdaysQuery = useQuery({
    queryKey: ["admin", "matchdays", teamFilter],
    queryFn: () =>
      actions.matchday.listMatchdays({
        teamId: teamFilter === "all" ? undefined : teamFilter,
        limit: 50,
      }),
  });

  const teams = teamsQuery.data?.data?.teams ?? [];
  const matchdays = (matchdaysQuery.data?.data?.matchdays ?? []).filter(
    (m): m is typeof m & { id: string } => m.id !== null,
  );

  if (selectedMatchdayId) {
    return (
      <MatchdayReport
        matchdayId={selectedMatchdayId}
        onBack={() => setSelectedMatchdayId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Game Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium">
              Filter by Team
            </label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {matchdaysQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : matchdays.length === 0 ? (
            <p className="text-sm text-gray-500">No matchdays found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Opposition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchdays.map((matchday) => (
                  <TableRow key={matchday.id}>
                    <TableCell>
                      {format(new Date(matchday.match_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{matchday.team_name ?? "Unknown"}</TableCell>
                    <TableCell>{matchday.opposition}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          matchday.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : matchday.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {matchday.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMatchdayId(matchday.id)}
                      >
                        View Report
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MatchdayReport({
  matchdayId,
  onBack,
}: {
  matchdayId: string;
  onBack: () => void;
}) {
  const reportQuery = useQuery({
    queryKey: ["admin", "matchdayReport", matchdayId],
    queryFn: () => actions.matchday.getMatchdayReport({ matchdayId }),
  });

  const data = reportQuery.data?.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        {reportQuery.isLoading ? (
          <p className="text-gray-500">Loading report...</p>
        ) : data ? (
          <div>
            <h3 className="text-lg font-semibold">
              {data.team?.name} vs {data.matchday.opposition}
            </h3>
            <p className="text-sm text-gray-500">
              {format(new Date(data.matchday.match_date), "EEEE d MMMM yyyy")}
              {data.matchday.competition_type && (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  {data.matchday.competition_type}
                </span>
              )}
            </p>
          </div>
        ) : null}
      </div>

      {reportQuery.isError && (
        <p className="text-red-600">Failed to load report.</p>
      )}

      {data && (
        <>
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-sm text-gray-500">Match Fee Income</p>
                  <p className="text-lg font-semibold">
                    {currencyFormatter.format(
                      data.summary.totalIncoming / 100,
                    )}
                  </p>
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-green-600">
                      Paid:{" "}
                      {currencyFormatter.format(data.summary.totalPaid / 100)}
                    </span>
                    <span className="text-yellow-600">
                      Outstanding:{" "}
                      {currencyFormatter.format(
                        data.summary.totalOutstanding / 100,
                      )}
                    </span>
                  </div>
                </div>
                {data.summary.sponsorshipIncome > 0 && (
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-sm text-gray-500">Sponsorship Income</p>
                    <p className="text-lg font-semibold">
                      {currencyFormatter.format(
                        data.summary.sponsorshipIncome / 100,
                      )}
                    </p>
                    {data.sponsorship && (
                      <p className="mt-1 text-xs text-gray-500">
                        {data.sponsorship.sponsor_name}
                      </p>
                    )}
                  </div>
                )}
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-sm text-gray-500">Total Expenses</p>
                  <p className="text-lg font-semibold">
                    {currencyFormatter.format(
                      data.summary.totalExpenses / 100,
                    )}
                  </p>
                </div>
                <div
                  className={`rounded border p-3 ${
                    data.summary.profitLoss >= 0
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <p className="text-sm text-gray-500">
                    {data.summary.profitLoss >= 0 ? "Profit" : "Loss"}
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      data.summary.profitLoss >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {currencyFormatter.format(
                      Math.abs(data.summary.profitLoss) / 100,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Players */}
          <Card>
            <CardHeader>
              <CardTitle>Players</CardTitle>
            </CardHeader>
            <CardContent>
              {data.players.length === 0 ? (
                <p className="text-sm text-gray-500">No players recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Match Fee</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.players.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">
                          {player.player_name}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              player.status === "playing"
                                ? "bg-green-100 text-green-800"
                                : player.status === "dropped_out"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : player.status === "no_show"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {player.status}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize text-sm text-gray-500">
                          {player.member_category ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.charge_amount_pence != null &&
                          player.charge_deleted_at == null
                            ? currencyFormatter.format(
                                player.charge_amount_pence / 100,
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {player.charge_deleted_at != null ? (
                            <span className="text-xs text-gray-400">
                              Deleted
                            </span>
                          ) : player.charge_paid_at ? (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                              Paid
                              {player.charge_payment_method && (
                                <span className="ml-1 text-green-600">
                                  ({player.charge_payment_method})
                                </span>
                              )}
                            </span>
                          ) : player.charge_amount_pence != null ? (
                            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                              Outstanding
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {data.expenses.length === 0 ? (
                <p className="text-sm text-gray-500">No expenses recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {EXPENSE_TYPE_LABELS[expense.expense_type] ??
                            expense.expense_type}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {expense.description ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(
                            expense.amount_pence / 100,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        {currencyFormatter.format(
                          data.summary.totalExpenses / 100,
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
