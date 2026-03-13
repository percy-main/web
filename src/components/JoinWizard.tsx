import { useSession } from "@/lib/auth/client";
import { buttonVariants } from "@/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/Card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FC } from "react";
import { MemberDetails, useMemberDetails } from "./MemberDetails";

const queryClient = new QueryClient();

const JoinWizardInner: FC = () => {
  const session = useSession();
  const memberQuery = useMemberDetails();

  if (!session.data || memberQuery.isLoading) return null;

  const email = session.data.user.email;
  const hasDetails = !!memberQuery.data?.member;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join Percy Main Community Sports Club</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-6 text-sm">
          Fill in your details so we can keep in touch and keep you safe at the
          club. You can skip this for now and complete it later.
        </p>
        {hasDetails ? (
          <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            Your details are already on file. You can proceed to payment.
          </div>
        ) : (
          <MemberDetails />
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <a
          href={`/membership/pay?email=${encodeURIComponent(email)}`}
          className={buttonVariants()}
        >
          Choose Membership
        </a>
      </CardFooter>
    </Card>
  );
};

export const JoinWizard: FC = () => (
  <QueryClientProvider client={queryClient}>
    <JoinWizardInner />
  </QueryClientProvider>
);
