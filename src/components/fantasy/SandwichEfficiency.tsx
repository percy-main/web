import { Badge } from "@/components/ui/Badge";
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

const MEDAL_COLORS: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-700",
};

export function SandwichEfficiency() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["fantasy", "sandwichEfficiency"],
    queryFn: async () => {
      const res = await actions.fantasy.getSandwichEfficiency({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading sandwich stats...</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-red-500">
        Failed to load sandwich efficiency data.
      </p>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No scoring data yet — sandwich efficiency will appear once matches have
        been played.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.isFromPreviousSeason && (
        <Badge variant="secondary" className="self-start">
          {data.season} Season
        </Badge>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="w-16 text-center">Cost</TableHead>
            <TableHead className="w-16 text-right">Pts</TableHead>
            <TableHead className="w-24 text-right">
              <span aria-hidden="true">Pts/🥪</span>
              <span className="sr-only">Points per sandwich</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.entries.map((entry) => (
            <TableRow key={entry.playCricketId}>
              <TableCell
                className={`font-medium ${MEDAL_COLORS[entry.rank] ?? ""}`}
              >
                {entry.rank}
              </TableCell>
              <TableCell className="font-medium">
                {entry.playerName}
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-sm" aria-label={`${entry.sandwichCost} sandwich${entry.sandwichCost !== 1 ? "es" : ""}`}>
                  {"🥪".repeat(entry.sandwichCost)}
                </span>
              </TableCell>
              <TableCell className="text-right">{entry.totalPoints}</TableCell>
              <TableCell className="text-right font-semibold">
                {entry.pointsPerSandwich.toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
