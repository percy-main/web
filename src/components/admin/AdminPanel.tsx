import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { useState } from "react";
import { ChargesTable } from "./ChargesTable";
import { ContactSubmissionsTable } from "./ContactSubmissionsTable";
import { JuniorsTable } from "./JuniorsTable";
import { MemberTable } from "./MemberTable";
import { SponsorshipsTable } from "./SponsorshipsTable";

const queryClient = new QueryClient();

type Tab = "members" | "juniors" | "charges" | "contacts" | "sponsorships";

export function AdminPanel() {
  const session = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("members");

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
        <div className="flex border-b border-gray-200">
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === "members" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("members")}
          >
            Members
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === "juniors" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("juniors")}
          >
            Juniors
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === "charges" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("charges")}
          >
            Charges
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === "contacts" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("contacts")}
          >
            Contact Submissions
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === "sponsorships" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("sponsorships")}
          >
            Sponsorships
          </button>
        </div>
        {activeTab === "members" && <MemberTable />}
        {activeTab === "juniors" && <JuniorsTable />}
        {activeTab === "charges" && <ChargesTable />}
        {activeTab === "contacts" && <ContactSubmissionsTable />}
        {activeTab === "sponsorships" && <SponsorshipsTable />}
      </div>
    </QueryClientProvider>
  );
}
