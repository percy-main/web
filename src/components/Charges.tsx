import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardTitle } from "@/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/Table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import { useState } from "react";
import { Alert, AlertDescription } from "@/ui/Alert";
import { PaymentForm } from "./PaymentForm";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const Charges = () => {
  const queryClient = useQueryClient();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{
    clientSecret: string;
    totalAmountPence: number;
    paymentIntentId: string;
  } | null>(null);

  const query = useQuery({
    queryKey: ["myCharges"],
    queryFn: async () => {
      const result = await actions.charges.getMyCharges({});
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const result = await actions.charges.payOutstandingBalance({});
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        const piId = data.clientSecret.split("_secret_")[0];
        setPaymentData({
          clientSecret: data.clientSecret,
          totalAmountPence: data.totalAmountPence,
          paymentIntentId: piId,
        });
      }
    },
    onError: () => {
      setPaymentError("Failed to create payment. Please try again.");
    },
  });

  const charges = query.data?.charges;

  if (query.isLoading) {
    return null;
  }

  if (!charges || charges.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-h4 mb-0">Payments</h2>
        <p className="text-sm text-gray-500">No payments yet.</p>
      </div>
    );
  }

  const unpaidCharges = charges.filter((c) => !c.paid_at && !c.payment_confirmed_at);
  const totalOutstandingPence = unpaidCharges.reduce(
    (sum, c) => sum + c.amount_pence,
    0,
  );

  if (paymentData) {
    return (
      <PaymentForm
        clientSecret={paymentData.clientSecret}
        amount={paymentData.totalAmountPence}
        onSuccess={async () => {
          try {
            const result = await actions.charges.confirmPayment({
              paymentIntentId: paymentData.paymentIntentId,
            });
            if (result.error) throw result.error;
          } catch {
            // Payment succeeded at Stripe; webhook will reconcile if confirm fails.
          }
          setPaymentData(null);
          void queryClient.invalidateQueries({ queryKey: ["myCharges"] });
        }}
        onCancel={() => setPaymentData(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h4 mb-0">Payments</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((charge) => (
            <TableRow key={charge.id}>
              <TableCell>
                {formatDate(charge.charge_date, "dd/MM/yyyy")}
              </TableCell>
              <TableCell>{charge.description}</TableCell>
              <TableCell>
                {currencyFormatter.format(charge.amount_pence / 100)}
              </TableCell>
              <TableCell>
                {charge.paid_at ? (
                  <Badge variant="success">Paid</Badge>
                ) : charge.payment_confirmed_at ? (
                  <Badge variant="info">Pending</Badge>
                ) : (
                  <Badge variant="warning">Unpaid</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {unpaidCharges.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <CardTitle className="text-base">
                Outstanding balance:{" "}
                {currencyFormatter.format(totalOutstandingPence / 100)}
              </CardTitle>
              <CardDescription>
                {unpaidCharges.length} unpaid{" "}
                {unpaidCharges.length === 1 ? "payment" : "payments"}
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setPaymentError(null);
                payMutation.mutate();
              }}
              disabled={payMutation.isPending}
            >
              {payMutation.isPending
                ? "Processing..."
                : "Pay Outstanding Balance"}
            </Button>
          </CardContent>
          {paymentError && (
            <CardContent className="pt-0">
              <Alert variant="destructive">
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};
