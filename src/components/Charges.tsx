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
    queryFn: () => actions.charges.getMyCharges({}),
  });

  const payMutation = useMutation({
    mutationFn: () => actions.charges.payOutstandingBalance({}),
    onSuccess: (result) => {
      if (result.data) {
        const piId = result.data.clientSecret.split("_secret_")[0];
        setPaymentData({
          clientSecret: result.data.clientSecret,
          totalAmountPence: result.data.totalAmountPence,
          paymentIntentId: piId,
        });
      }
    },
    onError: () => {
      setPaymentError("Failed to create payment. Please try again.");
    },
  });

  const charges = query.data?.data?.charges;

  if (query.isLoading) {
    return null;
  }

  if (!charges || charges.length === 0) {
    return null;
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
          await actions.charges.confirmPayment({
            paymentIntentId: paymentData.paymentIntentId,
          });
          setPaymentData(null);
          void queryClient.invalidateQueries({ queryKey: ["myCharges"] });
        }}
        onCancel={() => setPaymentData(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h4 mb-0">Charges</h2>
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
                {unpaidCharges.length === 1 ? "charge" : "charges"}
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
