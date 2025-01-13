import { useAuthQuery } from "better-auth/client";
import { reactClient, useSession } from "@/lib/auth/client";
import { useState } from "react";
import { navigate } from "astro:transitions/client";

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
      <h1>Members Area</h1>
      <p>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <p>
          {user.emailVerified ? (
            "Verified"
          ) : (
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
      <a
        className="justify-self-start mt-2 py-2 px-4 border-1  border-gray-800 hover:bg-gray-200 text-dark rounded text-sm"
        href="/logout"
      >
        Sign Out
      </a>
    </div>
  );
};
