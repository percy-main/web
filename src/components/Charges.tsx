import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import { useState } from "react";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const Charges = ({
  onPaymentStarted,
}: {
  onPaymentStarted?: (clientSecret: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["myCharges"],
    queryFn: () => actions.charges.getMyCharges({}),
  });

  const payMutation = useMutation({
    mutationFn: () => actions.charges.payOutstandingBalance({}),
    onSuccess: (result) => {
      if (result.data?.clientSecret && onPaymentStarted) {
        onPaymentStarted(result.data.clientSecret);
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

  const unpaidCharges = charges.filter((c) => !c.paid_at);
  const totalOutstandingPence = unpaidCharges.reduce(
    (sum, c) => sum + c.amount_pence,
    0,
  );

  return (
    <>
      <h2 className="text-h4 mb-0">Charges</h2>
      <div className="w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id} className="border-b">
                  <td className="px-3 py-2">
                    {formatDate(charge.charge_date, "dd/MM/yyyy")}
                  </td>
                  <td className="px-3 py-2">{charge.description}</td>
                  <td className="px-3 py-2">
                    {currencyFormatter.format(charge.amount_pence / 100)}
                  </td>
                  <td className="px-3 py-2">
                    {charge.paid_at ? (
                      <span className="inline-flex items-center rounded-sm bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-sm bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Unpaid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {unpaidCharges.length > 0 && (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Outstanding balance:{" "}
                  <span className="text-lg font-semibold text-gray-900">
                    {currencyFormatter.format(totalOutstandingPence / 100)}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {unpaidCharges.length} unpaid{" "}
                  {unpaidCharges.length === 1 ? "charge" : "charges"}
                </p>
              </div>
              <button
                onClick={() => {
                  setPaymentError(null);
                  payMutation.mutate();
                }}
                disabled={payMutation.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {payMutation.isPending
                  ? "Processing..."
                  : "Pay Outstanding Balance"}
              </button>
            </div>
            {paymentError && (
              <p className="mt-2 text-sm text-red-600">{paymentError}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};
