import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";
import { GameweekHistory } from "./GameweekHistory";
import { PlayerHistory } from "./PlayerHistory";
import { SeasonTimeline } from "./SeasonTimeline";

export function MyHistory() {
  const [viewingPlayer, setViewingPlayer] = useState<string | null>(null);

  const myTeamQuery = useQuery({
    queryKey: ["fantasy", "myTeam"],
    queryFn: () => actions.fantasy.getMyTeam({}),
  });

  const weeklyQuery = useQuery({
    queryKey: ["fantasy", "weeklyLeaderboard"],
    queryFn: async () => {
      const res = await actions.fantasy.getWeeklyLeaderboard({});
      if (res.error) throw res.error;
      return res.data;
    },
  });

  const teamData = myTeamQuery.data?.data;
  const team = teamData?.team;

  if (myTeamQuery.isLoading) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  if (!team) {
    return (
      <p className="text-sm text-gray-500">
        You don&apos;t have a team yet. Create your squad in the &quot;My Team&quot; tab to start
        tracking your history.
      </p>
    );
  }

  // If viewing a specific player's history
  if (viewingPlayer) {
    return (
      <PlayerHistory
        playCricketId={viewingPlayer}
        onBack={() => setViewingPlayer(null)}
      />
    );
  }

  const availableGameweeks = weeklyQuery.data?.availableGameweeks ?? [];

  return (
    <div className="flex flex-col gap-6">
      {team.id != null && (
        <>
          <SeasonTimeline
            teamId={team.id}
            ownerName="Your"
          />
          <GameweekHistory
            teamId={team.id}
            availableGameweeks={availableGameweeks}
            onViewPlayer={(id) => setViewingPlayer(id)}
          />
        </>
      )}
    </div>
  );
}
