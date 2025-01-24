import { reactClient, useSession } from "@/lib/auth/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { navigate } from "astro:transitions/client";
import { useState } from "react";
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
    <div className="flex flex-col items-start gap-4">
      <div className="flex w-full flex-row items-start justify-between">
        <h1>Members Area</h1>
        <a
          className="justify-self-start py-2 px-4 border-1  border-gray-800 hover:bg-gray-200 text-dark rounded text-sm"
          href="/auth/logout"
        >
          Sign Out
        </a>
      </div>
      <p>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
      </p>
      <QueryClientProvider client={new QueryClient()}>
        <h2 className="text-h4 mb-0">Your Subscriptions</h2>
        <Subscriptions />
        <h2 className="text-h4 mb-0">Payment History</h2>
        <Payments />
      </QueryClientProvider>
    </div>
  );
};
