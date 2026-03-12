import { Badge } from "@/components/ui/Badge";
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
import {
  CHAOS_RULE_LABELS,
  CHAOS_RULE_TYPES,
  type ChaosRuleType,
} from "@/lib/fantasy/scoring";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

function CreateChaosWeekForm({ onSuccess }: { onSuccess: () => void }) {
  const [gameweekId, setGameweekId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState<ChaosRuleType>("no_transfers");
  const [ruleConfig, setRuleConfig] = useState("{}");
  const [sendEmail, setSendEmail] = useState(true);

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await actions.fantasy.createChaosWeek({
        gameweekId: parseInt(gameweekId),
        name,
        description,
        ruleType,
        ruleConfig,
        sendEmail,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      setGameweekId("");
      setName("");
      setDescription("");
      setRuleType("no_transfers");
      setRuleConfig("{}");
      setSendEmail(true);
      onSuccess();
    },
  });

  const needsConfig =
    ruleType === "scoring_modifier" || ruleType === "scoring_threshold";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Chaos Week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Gameweek</label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 5"
              value={gameweekId}
              onChange={(e) => setGameweekId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Rule Type</label>
            <Select
              value={ruleType}
              onValueChange={(v) => {
                setRuleType(v as ChaosRuleType);
                if (v === "scoring_modifier") {
                  setRuleConfig(
                    JSON.stringify(
                      {
                        sandwich_cost_min: 1,
                        sandwich_cost_max: 1,
                        multiplier: 2,
                      },
                      null,
                      2,
                    ),
                  );
                } else if (v === "scoring_threshold") {
                  setRuleConfig(
                    JSON.stringify(
                      { min_runs: 30, min_wickets: 3 },
                      null,
                      2,
                    ),
                  );
                } else {
                  setRuleConfig("{}");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAOS_RULE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CHAOS_RULE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder='e.g. "Sandwich Inflation Crisis"'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="border-input bg-background flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              placeholder="What does this chaos rule do? This will be shown to players."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {needsConfig && (
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-medium">Rule Config (JSON)</label>
              <textarea
                className="border-input bg-background font-mono flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                value={ruleConfig}
                onChange={(e) => setRuleConfig(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                {ruleType === "scoring_modifier"
                  ? 'Keys: sandwich_cost_min, sandwich_cost_max, multiplier'
                  : 'Keys: min_runs, min_wickets'}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="sendEmail"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <label htmlFor="sendEmail" className="text-sm">
              Allow sending announcement email
            </label>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending || !gameweekId || !name || !description
            }
          >
            {createMutation.isPending ? "Creating..." : "Create Chaos Week"}
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-red-600">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create chaos week."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChaosWeeksTable() {
  const queryClient = useQueryClient();

  const chaosWeeksQuery = useQuery({
    queryKey: ["admin", "chaosWeeks"],
    queryFn: async () => {
      const result = await actions.fantasy.listChaosWeeks({});
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const result = await actions.fantasy.deleteChaosWeek({ id });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "chaosWeeks"] });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (id: number): Promise<{ sent: number; total: number }> => {
      const result = await actions.fantasy.sendChaosWeekEmail({ id });
      if (result.error) throw result.error;
      return result.data as { sent: number; total: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "chaosWeeks"] });
    },
  });

  const weeks = chaosWeeksQuery.data?.weeks ?? [];

  return (
    <div className="flex flex-col gap-4">
      <CreateChaosWeekForm
        onSuccess={() => {
          void queryClient.invalidateQueries({
            queryKey: ["admin", "chaosWeeks"],
          });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Chaos Weeks{" "}
            {weeks.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({weeks.length} configured)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chaosWeeksQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : weeks.length === 0 ? (
            <p className="text-sm text-gray-500">
              No chaos weeks configured yet. Create one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GW</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map((week) => (
                  <TableRow key={week.id}>
                    <TableCell className="font-medium">
                      {week.gameweek_id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{week.name}</p>
                        <p className="text-xs text-gray-500">
                          {week.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CHAOS_RULE_LABELS[
                          week.rule_type as ChaosRuleType
                        ] ?? week.rule_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {week.email_sent === 1 ? (
                        <Badge className="bg-green-100 text-green-800">
                          Sent
                        </Badge>
                      ) : week.send_email === 1 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendEmailMutation.isPending}
                          onClick={() => {
                            if (week.id !== null) {
                              sendEmailMutation.mutate(week.id);
                            }
                          }}
                        >
                          {sendEmailMutation.isPending
                            ? "Sending..."
                            : "Send Email"}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">Disabled</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (week.id !== null) {
                            deleteMutation.mutate(week.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {sendEmailMutation.data && (
            <p className="mt-2 text-sm text-green-600">
              Email sent to {sendEmailMutation.data.sent} of{" "}
              {sendEmailMutation.data.total} team managers.
            </p>
          )}
          {deleteMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              Failed to delete chaos week.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
