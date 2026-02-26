import { useSession } from "@/lib/auth/client";
import { Alert, AlertDescription } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { useMutation } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { navigate } from "astro:transitions/client";
import { useState } from "react";
import { ContactSubmissionsTable } from "./ContactSubmissionsTable";
import { JuniorsTable } from "./JuniorsTable";
import { MemberTable } from "./MemberTable";

const queryClient = new QueryClient();

type Tab = "members" | "juniors" | "contacts";

function BackfillButton() {
  const [result, setResult] = useState<{
    totalMembers: number;
    totalProcessed: number;
    totalSkipped: number;
    errors: string[];
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () => actions.admin.backfillStripePayments({}),
    onSuccess: (res) => {
      if (res.data) {
        setResult(res.data);
      }
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (
              window.confirm(
                "This will import historical Stripe payments into the charge table. This is safe to run multiple times. Continue?",
              )
            ) {
              mutation.mutate();
            }
          }}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Backfilling..." : "Backfill Stripe Payments"}
        </Button>
      </div>
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to run backfill. Please try again.
          </AlertDescription>
        </Alert>
      )}
      {result && (
        <Alert>
          <AlertDescription>
            Backfill complete: {result.totalProcessed} succeeded charges
            processed across {result.totalMembers} members (
            {result.totalSkipped} failed/pending charges skipped). Duplicates
            are automatically excluded.
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-600">
                  {result.errors.length} errors
                </summary>
                <ul className="mt-1 list-disc pl-4 text-sm">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

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
          <div className="flex items-center gap-4">
            <BackfillButton />
            <a
              className="text-dark rounded border border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
              href="/members"
            >
              Back to Members Area
            </a>
          </div>
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
            className={`px-4 py-2 text-sm font-medium ${activeTab === "contacts" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("contacts")}
          >
            Contact Submissions
          </button>
        </div>
        {activeTab === "members" && <MemberTable />}
        {activeTab === "juniors" && <JuniorsTable />}
        {activeTab === "contacts" && <ContactSubmissionsTable />}
      </div>
    </QueryClientProvider>
  );
}
