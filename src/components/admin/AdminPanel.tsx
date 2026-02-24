import { useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { MemberTable } from "./MemberTable";

const queryClient = new QueryClient();

export function AdminPanel() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!session.data) {
    navigate("/auth/login");
    return null;
  }

  if (session.data.user.role !== "admin") {
    navigate("/members");
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
        <MemberTable />
      </div>
    </QueryClientProvider>
  );
}
