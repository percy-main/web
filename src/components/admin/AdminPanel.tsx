import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { ChargesTable } from "./ChargesTable";
import { ContactSubmissionsTable } from "./ContactSubmissionsTable";
import { DuplicateMembersTable } from "./DuplicateMembersTable";
import { JuniorsTable } from "./JuniorsTable";
import { MemberTable } from "./MemberTable";
import { RecordLinking } from "./RecordLinking";
import { SponsorshipsTable } from "./SponsorshipsTable";

const queryClient = new QueryClient();

export function AdminPanel() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!session.data) {
    void navigate("/auth/login");
    return null;
  }

  if (session.data.user.role !== "admin") {
    void navigate("/members");
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1>Admin Panel</h1>
          <a
            className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
            href="/members"
          >
            Back to Members Area
          </a>
        </div>
        <Tabs defaultValue="members">
          <TabsList className="flex-wrap">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="juniors">Juniors</TabsTrigger>
            <TabsTrigger value="charges">Charges</TabsTrigger>
            <TabsTrigger value="contacts">Contact Submissions</TabsTrigger>
            <TabsTrigger value="sponsorships">Sponsorships</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
            <TabsTrigger value="record-linking">Record Linking</TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MemberTable />
          </TabsContent>
          <TabsContent value="juniors">
            <JuniorsTable />
          </TabsContent>
          <TabsContent value="charges">
            <ChargesTable />
          </TabsContent>
          <TabsContent value="contacts">
            <ContactSubmissionsTable />
          </TabsContent>
          <TabsContent value="sponsorships">
            <SponsorshipsTable />
          </TabsContent>
          <TabsContent value="duplicates">
            <DuplicateMembersTable />
          </TabsContent>
          <TabsContent value="record-linking">
            <RecordLinking />
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
}
