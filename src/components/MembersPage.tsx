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
    <div className="flex flex-col gap-4">
      <h1>Members Area</h1>
      <p>
        {user.name} - {user.email} (
        {user.emailVerified ? (
          "Verified"
        ) : (
          <button disabled={isVerifying} onClick={verify}>
            Verify Now
          </button>
        )}
        )
      </p>
      <a href="/logout">Sign Out</a>
    </div>
  );
};
