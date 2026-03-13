import { useSession } from "@/lib/auth/client";
import { Button, buttonVariants } from "@/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/Card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FC } from "react";
import { useState } from "react";
import { MemberDetails, useMemberDetails } from "./MemberDetails";

const queryClient = new QueryClient();

type Step = "details" | "pay";

const JoinWizardInner: FC = () => {
  const session = useSession();
  const memberQuery = useMemberDetails();
  const [step, setStep] = useState<Step>("details");

  if (!session.data || memberQuery.isLoading) return null;

  const email = session.data.user.email;
  const hasDetails = !!memberQuery.data?.member;

  if (step === "details") {
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
          {!hasDetails && (
            <Button variant="ghost" onClick={() => setStep("pay")}>
              Skip for now
            </Button>
          )}
          <Button onClick={() => setStep("pay")}>
            {hasDetails ? "Continue to Payment" : "Next"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Membership</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Select your membership type and payment schedule on the next page.
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={() => setStep("details")}>
          Back
        </Button>
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
