import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { actions } from "astro:actions";
import { useState } from "react";
import { Leaderboard } from "./Leaderboard";
import { MyHistory } from "./MyHistory";
import { TeamSelector } from "./TeamSelector";
import { TeamsOverview } from "./TeamsOverview";

const TABS = ["my-team", "all-teams", "leaderboards", "history"] as const;
type Tab = (typeof TABS)[number];

function getInitialTab(): Tab {
  const param = new URLSearchParams(window.location.search).get("tab");
  return TABS.includes(param as Tab) ? (param as Tab) : "my-team";
}

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
          href="/fantasy/rules"
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
  const [tab, setTab] = useState<Tab>(getInitialTab);

  const onTabChange = (value: string) => {
    setTab(value as Tab);
    const url = new URL(window.location.href);
    if (value === "my-team") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url);
  };

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

  // If viewing a tab that requires auth and not logged in, redirect
  if (!isLoading && !isLoggedIn && tab !== "leaderboards") {
    void navigate("/auth/login");
    return null;
  }

  if (isLoading && tab !== "leaderboards") {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Fantasy Cricket</h1>
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

      {/* In-app reminder banner */}
      {isLoggedIn && <TransferReminderBanner />}

      {/* Onboarding for users without a team */}
      {isLoggedIn && !myTeamQuery.isLoading && !hasTeam && tab === "my-team" && (
        <OnboardingBanner />
      )}

      <Tabs value={tab} onValueChange={onTabChange}>
        <div className="overflow-x-auto">
          <TabsList>
            {isLoggedIn && <TabsTrigger value="my-team">My Team</TabsTrigger>}
            {isLoggedIn && (
              <TabsTrigger value="all-teams">All Teams</TabsTrigger>
            )}
            <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
            {isLoggedIn && <TabsTrigger value="history">History</TabsTrigger>}
          </TabsList>
        </div>
        {isLoggedIn && (
          <TabsContent value="my-team">
            <TeamSelector />
          </TabsContent>
        )}
        {isLoggedIn && (
          <TabsContent value="all-teams">
            <TeamsOverview />
          </TabsContent>
        )}
        <TabsContent value="leaderboards">
          <Leaderboard />
        </TabsContent>
        {isLoggedIn && (
          <TabsContent value="history">
            <MyHistory />
          </TabsContent>
        )}
      </Tabs>
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
