import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

const MEMBER_CATEGORIES = [
  "senior",
  "junior",
  "student",
  "guest",
] as const;

const COMPETITION_TYPES = ["League", "Cup", "Friendly"] as const;

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export function MatchFeeRatesTable() {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newTeamId, setNewTeamId] = useState<string>("all");
  const [newCompetitionType, setNewCompetitionType] = useState("");

  const ratesQuery = useQuery({
    queryKey: ["admin", "matchFeeRates"],
    queryFn: async () => {
      const result = await actions.matchday.listMatchFeeRates();
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const teamsQuery = useQuery({
    queryKey: ["admin", "playCricketTeams"],
    queryFn: async () => {
      const result = await actions.playCricket.getTeams();
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const addRateMutation = useMutation({
    mutationFn: async (input: {
      playCricketTeamId?: string;
      competitionType?: string;
      memberCategory: string;
      amountPence: number;
    }) => {
      const result = await actions.matchday.addMatchFeeRate(input);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      setNewCategory("");
      setNewAmount("");
      setNewTeamId("all");
      setNewCompetitionType("");
      void queryClient.invalidateQueries({
        queryKey: ["admin", "matchFeeRates"],
      });
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (rateId: string) => {
      const result = await actions.matchday.deleteMatchFeeRate({ rateId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "matchFeeRates"],
      });
    },
  });

  const rates = (ratesQuery.data ?? []).filter(
    (r): r is typeof r & { id: string } => r.id !== null,
  );
  const teams = teamsQuery.data?.teams ?? [];

  const handleAdd = () => {
    if (!newCategory || !newAmount) return;
    const amountPence = Math.round(parseFloat(newAmount) * 100);
    if (isNaN(amountPence) || amountPence < 0) return;

    addRateMutation.mutate({
      memberCategory: newCategory,
      amountPence,
      playCricketTeamId: newTeamId === "all" ? undefined : newTeamId,
      competitionType: newCompetitionType || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Fee Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Team</label>
              <Select value={newTeamId} onValueChange={setNewTeamId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams (default)</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Member Category
              </label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="capitalize">{cat}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Competition Type
              </label>
              <Select
                value={newCompetitionType || "any"}
                onValueChange={(v) =>
                  setNewCompetitionType(v === "any" ? "" : v)
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any (default)</SelectItem>
                  {COMPETITION_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {ct}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Amount</label>
              <Input
                className="w-24"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={
                !newCategory || !newAmount || addRateMutation.isPending
              }
            >
              {addRateMutation.isPending ? "Adding..." : "Add Rate"}
            </Button>
          </div>
          {addRateMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              Failed to add rate.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {ratesQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : rates.length === 0 ? (
            <p className="text-sm text-gray-500">
              No fee rates configured. Add rates above so match fees can be
              generated when a team is confirmed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Competition</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      {rate.team_name ?? "All teams"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {rate.member_category}
                    </TableCell>
                    <TableCell>
                      {rate.competition_type ?? "Any"}
                    </TableCell>
                    <TableCell className="text-right">
                      {currencyFormatter.format(rate.amount_pence / 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        disabled={deleteRateMutation.isPending}
                        onClick={() => deleteRateMutation.mutate(rate.id)}
                      >
                        Delete
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
