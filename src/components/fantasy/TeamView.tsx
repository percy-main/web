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
import { generateTeamImage } from "@/lib/fantasy/generate-team-image";
import { useMutation, useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useCallback, useState } from "react";

export function TeamView({ teamId }: { teamId: number }) {
  const teamQuery = useQuery({
    queryKey: ["fantasy", "team", teamId],
    queryFn: async () => {
      const result = await actions.fantasy.getTeam({ teamId });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const data = teamQuery.data;

  if (teamQuery.isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!data) {
    return <p className="text-gray-500">Team not found.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{data.team.ownerName}&apos;s Team</CardTitle>
          <ShareButton teamId={teamId} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-center">Slot</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-16 text-right">Owned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.players.map((player) => (
              <TableRow key={player.playCricketId}>
                <TableCell className="font-medium">
                  {player.playerName}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">
                    {player.slotType === "batting"
                      ? "🏏"
                      : player.slotType === "bowling"
                        ? "🎳"
                        : "🏏🎳"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {player.isCaptain && (
                      <Badge className="bg-amber-100 text-amber-800">C</Badge>
                    )}
                    {player.isWicketkeeper && (
                      <Badge className="bg-blue-100 text-blue-800">WK</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {player.ownershipPct > 0 ? `${player.ownershipPct}%` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ShareButton({ teamId }: { teamId: number }) {
  const [shared, setShared] = useState(false);

  const shareMutation = useMutation({
    mutationFn: async () => {
      const result = await actions.fantasy.getTeamShareData({ teamId });
      if (result.error) throw result.error;
      const blob = await generateTeamImage(result.data);
      return blob;
    },
    onSuccess: useCallback(async (blob: Blob) => {
      const file = new File([blob], "my-fantasy-team.png", {
        type: "image/png",
      });

      // Try Web Share API (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "My Fantasy Cricket Team",
          });
          setShared(true);
          setTimeout(() => setShared(false), 2000);
          return;
        } catch {
          // User cancelled or share failed — fall through to download
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-fantasy-team.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }, []),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => shareMutation.mutate()}
      disabled={shareMutation.isPending}
    >
      {shareMutation.isPending
        ? "Generating..."
        : shared
          ? "Done!"
          : "Share Team"}
    </Button>
  );
}
