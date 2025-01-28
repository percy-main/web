import { reactClient, useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { useState } from "react";
import { Payments } from "./Payments";
import { Subscriptions } from "./Subscriptions";

export const MembersPage = () => {
  const session = useSession();
  const [isVerifying, setIsVerifying] = useState(false);

  const verify = async () => {
    try {
      setIsVerifying(true);
      await reactClient.sendVerificationEmail({
        email: session.data?.user.email!,
      });
    } catch {
      setIsVerifying(false);
    }
  };

  const hasData = !!session?.data;

  if (!session.isPending && !hasData) {
    return navigate("/login");
  }

  if (!hasData) {
    return null;
  }

  const { user } = session.data!;

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex w-full flex-row items-start justify-between">
        <h1>Members Area</h1>
        <a
          className="text-dark justify-self-start rounded-sm border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
          href="/logout"
        >
          Sign Out
        </a>
      </div>
      <p>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <p>
          {!user.emailVerified && (
            <button
              className="mt-2 cursor-pointer rounded-sm bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-700"
              disabled={isVerifying}
              onClick={verify}
            >
              Verify Now
            </button>
          )}
        </p>
      </p>
      {user.emailVerified ? (
        <QueryClientProvider client={new QueryClient()}>
          <h2 className="text-h4 mb-0">Your Subscriptions</h2>
          <Subscriptions />
          <h2 className="text-h4 mb-0">Payment History</h2>
          <Payments />
        </QueryClientProvider>
      ) : (
        <p>Verify your email to see your purchase history</p>
      )}
    </div>
  );
};
