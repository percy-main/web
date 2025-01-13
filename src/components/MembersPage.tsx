import { reactClient, useSession } from "@/lib/auth/client";
import { useState } from "react";
import { navigate } from "astro:transitions/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Purchases } from "./Purchases";

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
    <div className="flex flex-col gap-4 items-start">
      <div className="flex flex-row items-start justify-between w-full">
        <h1>Members Area</h1>
        <a
          className="justify-self-start py-2 px-4 border-1  border-gray-800 hover:bg-gray-200 text-dark rounded text-sm"
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
              className=" mt-2 py-2 px-4 bg-blue-500 hover:bg-blue-700 text-white rounded text-sm cursor-pointer"
              disabled={isVerifying}
              onClick={verify}
            >
              Verify Now
            </button>
          )}
        </p>
      </p>
      <h2 className="text-h4 mb-0">Your Orders</h2>
      <QueryClientProvider client={new QueryClient()}>
        <Purchases />
      </QueryClientProvider>
    </div>
  );
};
