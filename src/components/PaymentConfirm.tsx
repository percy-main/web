import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/ui/Card";
import type { FC } from "react";

export const PaymentConfirm: FC = () => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("redirect_status");

  if (status === "succeeded") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Successful</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Thank you for your payment. You will receive a confirmation email
            shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "processing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Your payment is being processed. You will receive a confirmation
            email once it is complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Failed</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          Something went wrong with your payment. Please go back and try again.
        </p>
      </CardContent>
    </Card>
  );
};
