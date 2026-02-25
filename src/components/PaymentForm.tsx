import { Alert, AlertDescription } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/ui/Card";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { STRIPE_PUBLIC_KEY } from "astro:env/client";
import { type FC, type FormEvent, useState } from "react";

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  title?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutForm: FC<{
  amount: number;
  title: string;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ amount, title, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PaymentElement />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!stripe || processing}>
            {processing
              ? "Processing..."
              : `Pay ${currencyFormatter.format(amount / 100)}`}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export const PaymentForm: FC<PaymentFormProps> = ({
  clientSecret,
  amount,
  title = "Pay Outstanding Balance",
  onSuccess,
  onCancel,
}) => {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <CheckoutForm
        amount={amount}
        title={title}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
};
