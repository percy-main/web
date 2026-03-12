import { Alert } from "@/components/ui/Alert";
import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { actions } from "astro:actions";
import { ChaosWeekBanner } from "./ChaosWeekBanner";
import { TeamSelector } from "./TeamSelector";

const queryClient = new QueryClient();

function TransferReminderBanner() {
  const myTeamQuery = useQuery({
    queryKey: ["fantasy", "myTeam"],
    queryFn: async () => {
      const result = await actions.fantasy.getMyTeam({});
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const teamData = myTeamQuery.data;

  // Show reminder if: user has a team, it's not pre-season, not locked, and
  // the transfer window is open with 2 or fewer days until lock
  if (
    !teamData?.team ||
    teamData.transferWindowInfo?.isPreSeason ||
    teamData.transferWindowInfo?.locked
  ) {
    return null;
  }

  const daysUntilLock = teamData.transferWindowInfo?.daysUntilLock ?? 99;
  if (daysUntilLock > 2) return null;

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <p className="text-sm">
        Teams lock in {daysUntilLock} {daysUntilLock === 1 ? "day" : "days"} (Friday 23:59 UK time).
        Review your squad and make any transfers before the deadline.
      </p>
    </Alert>
  );
}

function OnboardingBanner() {
  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-800">
      <div className="space-y-2 text-sm">
        <p className="font-medium">Welcome to Fantasy Cricket!</p>
        <p>
          Select 11 players from the eligible player pool below to build your squad.
          Choose one captain whose points will be doubled. You can make unlimited changes
          to your initial squad.
        </p>
        <p>
          Once the season starts, you&apos;ll be limited to 3 transfers per gameweek.
          Teams lock on Friday evening and reopen Monday.
        </p>
        <a
          href="/fantasy?tab=rules"
          className="inline-block text-blue-600 underline hover:text-blue-800"
        >
          View full scoring rules
        </a>
      </div>
    </Alert>
  );
}

function FantasyPageContent() {
  const session = useSession();

  const isLoggedIn = !!session.data;
  const isLoading = session.isPending;

  // Check if user has a team (for onboarding banner) — must be before conditional returns
  const myTeamQuery = useQuery({
    queryKey: ["fantasy", "myTeam"],
    queryFn: async () => {
      const result = await actions.fantasy.getMyTeam({});
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: isLoggedIn,
  });

  const hasTeam = !!myTeamQuery.data?.team;

  if (!isLoading && !isLoggedIn) {
    void navigate("/auth/login");
    return null;
  }

  if (isLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>My Fantasy Team</h1>
        <div className="flex gap-2">
          <a
            className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            href="/fantasy"
          >
            Fantasy Home
          </a>
          <a
            className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            href="/members"
          >
            Members Area
          </a>
        </div>
      </div>

      {/* Chaos week banner */}
      <ChaosWeekBanner />

      {/* In-app reminder banner */}
      <TransferReminderBanner />

      {/* Onboarding for users without a team */}
      {!myTeamQuery.isLoading && !hasTeam && <OnboardingBanner />}

      <TeamSelector />
    </div>
  );
}

export function FantasyPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <FantasyPageContent />
    </QueryClientProvider>
  );
}
