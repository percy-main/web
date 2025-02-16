import { useSession } from "@/lib/auth/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/Tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { Juniors } from "./tabs/Juniors/Juniors";
import { Membership } from "./tabs/Membership/Membership";
import { Payments } from "./tabs/Payments/Payments";
import { Security } from "./tabs/Security/Security";

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
      <div className="flex flex-col items-start justify-stretch gap-4">
        <div className="flex w-full flex-row items-start justify-between">
          <h1>Members Area</h1>
          <div className="flex flex-row flex-wrap gap-4">
            {session.data.user.role === "admin" ? (
              <a
                className="text-dark justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
                href="#"
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
        <Tabs defaultValue="membership" className="w-full">
          <TabsList>
            <TabsTrigger value="membership">Membership</TabsTrigger>
            <TabsTrigger value="juniors">Juniors</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="membership">
            <Membership name={user.name} email={user.email} />
          </TabsContent>
          <TabsContent value="juniors">
            <Juniors />
          </TabsContent>
          <TabsContent value="security">
            <Security user={user} />
          </TabsContent>
          <TabsContent value="payments">
            <Payments />
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
};
