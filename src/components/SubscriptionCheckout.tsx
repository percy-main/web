import type { Price } from "@/collections/price";
import { useSearchParam } from "@/hooks/useSearchParams";
import { membershipSchema } from "@/lib/payments/metadata";
import { Alert, AlertDescription } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/Card";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { z } from "astro/zod";
import { type FC, useState } from "react";
import { PaymentForm } from "./PaymentForm";

const queryClient = new QueryClient();

type Props = {
  price: Price;
};

type State =
  | { step: "ready" }
  | { step: "paying"; clientSecret: string }
  | { step: "success" };

const SubscriptionCheckoutInner: FC<Props> = ({ price }) => {
  const [state, setState] = useState<State>({ step: "ready" });

  const metadata = useSearchParam({
    param: "metadata",
    parse: (val) => JSON.parse(val),
    schema: membershipSchema,
  });

  const email = useSearchParam({
    param: "email",
    schema: z.string().optional(),
  });

  const subscribeMutation = useMutation({
    mutationFn: () => {
      if (!email) throw new Error("Email is required");
      return actions.subscribe({
        priceId: price.id,
        membership: metadata.membership,
        email,
      });
    },
    onSuccess: (result) => {
      if (result.data) {
        setState({
          step: "paying",
          clientSecret: result.data.clientSecret,
        });
      }
    },
  });

  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Missing Email</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            An email address is required to set up a subscription. Please{" "}
            <a href="/membership/join" className="text-blue-600 underline">
              join the club
            </a>{" "}
            first.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state.step === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Active</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Thank you! Your {price.product.name} membership is now active. You
            will receive a confirmation email shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state.step === "paying") {
    return (
      <PaymentForm
        clientSecret={state.clientSecret}
        amount={price.unitAmount}
        title={price.product.name}
        onSuccess={() => setState({ step: "success" })}
        onCancel={() => setState({ step: "ready" })}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{price.product.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span>Price</span>
          <span>{price.formattedPrice}/month</span>
        </div>
        {subscribeMutation.error && (
          <Alert variant="destructive">
            <AlertDescription>
              Something went wrong setting up your subscription. Please try
              again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => subscribeMutation.mutate()}
          disabled={subscribeMutation.isPending}
        >
          {subscribeMutation.isPending ? "Processing..." : "Subscribe"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export const SubscriptionCheckout: FC<Props> = (props) => (
  <QueryClientProvider client={queryClient}>
    <SubscriptionCheckoutInner {...props} />
  </QueryClientProvider>
);
