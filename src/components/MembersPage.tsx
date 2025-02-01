import { useSession } from "@/lib/auth/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/Tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { Membership } from "./Membership";
import { Passkeys } from "./Passkeys";
import { Payments } from "./Payments";
import { Subscriptions } from "./Subscriptions";

export const MembersPage = () => {
  const session = useSession();

  const hasData = !!session?.data;
  if (!session.isPending && !hasData) {
    return navigate("/auth/login");
  }

  if (!session.data) {
    return null;
  }

  const { user } = session.data;

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full flex-row items-start justify-between">
          <h1>Members Area</h1>
          <a
            className="text-dark justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            href="/auth/logout"
          >
            Sign Out
          </a>
        </div>
        <Tabs defaultValue="membership" className="w-full max-w-2xl">
          <TabsList>
            <TabsTrigger value="membership">Membership</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="membership">
            <div className="flex w-full flex-row justify-between gap-4">
              <div>
                <h2>{user.name}</h2>
                <p>{user.email}</p>
              </div>
              <Membership email={user.email} />
            </div>
          </TabsContent>
          <TabsContent value="security">
            <Passkeys />
          </TabsContent>
          <TabsContent value="payments">
            <div className="flex flex-col gap-8">
              <Subscriptions />
              <Payments />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
};
