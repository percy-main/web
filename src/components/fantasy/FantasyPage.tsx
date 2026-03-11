import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { useState } from "react";
import { TeamSelector } from "./TeamSelector";
import { TeamsOverview } from "./TeamsOverview";

const TABS = ["my-team", "all-teams"] as const;
type Tab = (typeof TABS)[number];

function getInitialTab(): Tab {
  const param = new URLSearchParams(window.location.search).get("tab");
  return TABS.includes(param as Tab) ? (param as Tab) : "my-team";
}

const queryClient = new QueryClient();

export function FantasyPage() {
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

  if (session.isPending) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!session.data) {
    void navigate("/auth/login");
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1>Fantasy Cricket</h1>
          <a
            className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            href="/members"
          >
            Back to Members Area
          </a>
        </div>
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="my-team">My Team</TabsTrigger>
            <TabsTrigger value="all-teams">All Teams</TabsTrigger>
          </TabsList>
          <TabsContent value="my-team">
            <TeamSelector />
          </TabsContent>
          <TabsContent value="all-teams">
            <TeamsOverview />
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
}
