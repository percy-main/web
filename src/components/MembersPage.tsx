import { useSession } from "@/lib/auth/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/Tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { useState } from "react";
import { ChangePassword } from "./ChangePassword";
import { Charges } from "./Charges";
import { MemberDetails, useMemberDetails } from "./MemberDetails";
import { Membership } from "./Membership";
import { Passkeys } from "./Passkeys";
import { Subscriptions } from "./Subscriptions";
import { TwoFactor } from "./TwoFactor";

const TABS = ["membership", "details", "security", "payments"] as const;
type Tab = (typeof TABS)[number];

function getInitialTab(): Tab {
  const param = new URLSearchParams(window.location.search).get("tab");
  return TABS.includes(param as Tab) ? (param as Tab) : "membership";
}

const queryClient = new QueryClient();

export const MembersPage = () => {
  const session = useSession();
  const [tab, setTab] = useState<Tab>(getInitialTab);

  const onTabChange = (value: string) => {
    setTab(value as Tab);
    const url = new URL(window.location.href);
    if (value === "membership") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url);
  };

  const hasData = !!session?.data;
  if (!session.isPending && !hasData) {
    return navigate("/auth/login");
  }

  if (!session.data) {
    return null;
  }

  const { user } = session.data;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col items-start justify-stretch gap-4">
        <div className="flex w-full flex-row items-start justify-between">
          <h1>Members Area</h1>
          <div className="flex flex-row flex-wrap gap-4">
            {session.data.user.role === "admin" ? (
              <a
                className="text-dark justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
                href="/admin"
              >
                Admin Panel
              </a>
            ) : null}

            <a
              className="text-dark justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
              href="/auth/logout"
            >
              Sign Out
            </a>
          </div>
        </div>
        <IncompleteDetailsBanner />
        <Tabs value={tab} onValueChange={onTabChange} className="w-full">
          <TabsList>
            <TabsTrigger value="membership">Membership</TabsTrigger>
            <TabsTrigger value="details">Your Details</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="membership">
            <div className="flex flex-col gap-4">
              <div>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
              </div>
              <Membership email={user.email} />
            </div>
          </TabsContent>
          <TabsContent value="details">
            <MemberDetails />
          </TabsContent>
          <TabsContent value="security">
            <div className="flex flex-col gap-4">
              <ChangePassword />
              <Passkeys />
              <TwoFactor user={user} />
            </div>
          </TabsContent>
          <TabsContent value="payments">
            <div className="flex flex-col gap-8">
              <Charges />
              <Subscriptions />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
};

function IncompleteDetailsBanner() {
  const query = useMemberDetails();

  if (query.isLoading || query.data?.data?.member) return null;

  return (
    <div className="w-full rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      Your details are incomplete. Please go to the{" "}
      <strong>Your Details</strong> tab to fill them in.
    </div>
  );
}
