import type { Price } from "@/collections/price";
import { useSearchParam } from "@/hooks/useSearchParams";
import { metadata as metadataSchema } from "@/lib/payments/metadata";
import { Alert, AlertDescription } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/Card";
import { useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { z } from "astro:schema";
import { type FC, useState } from "react";
import { PaymentForm } from "./PaymentForm";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Props = {
  price: Price;
};

type State =
  | { step: "ready" }
  | {
      step: "paying";
      clientSecret: string;
      amount: number;
      productName: string;
    }
  | { step: "success"; productName: string };

export const PurchaseCheckout: FC<Props> = ({ price }) => {
  const [state, setState] = useState<State>({ step: "ready" });
  const [quantity, setQuantity] = useState(1);

  const metadata = useSearchParam({
    param: "metadata",
    parse: (val) => JSON.parse(val),
    schema: metadataSchema,
  });

  const email = useSearchParam({
    param: "email",
    schema: z.string().optional(),
  });

  const purchaseMutation = useMutation({
    mutationFn: () =>
      actions.purchase({
        priceId: price.id,
        quantity,
        metadata,
        email,
      }),
    onSuccess: (result) => {
      if (result.data) {
        setState({
          step: "paying",
          clientSecret: result.data.clientSecret,
          amount: result.data.amount,
          productName: result.data.productName,
        });
      }
    },
  });

  if (state.step === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Successful</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Thank you for your purchase of {state.productName}. You will receive
            a confirmation email shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state.step === "paying") {
    return (
      <PaymentForm
        clientSecret={state.clientSecret}
        amount={state.amount}
        title={state.productName}
        onSuccess={() =>
          setState({ step: "success", productName: state.productName })
        }
        onCancel={() => setState({ step: "ready" })}
      />
    );
  }

  const totalAmount = price.unitAmount * quantity;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{price.product.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span>Price</span>
          <span>{price.formattedPrice} each</span>
        </div>
        {price.qtyAdjustable && (
          <div className="flex items-center justify-between">
            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              type="number"
              min={1}
              max={price.maxQty}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-20 rounded border px-2 py-1 text-right"
            />
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-4 font-semibold">
          <span>Total</span>
          <span>{currencyFormatter.format(totalAmount / 100)}</span>
        </div>
        {purchaseMutation.error && (
          <Alert variant="destructive">
            <AlertDescription>
              Something went wrong creating your payment. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => purchaseMutation.mutate()}
          disabled={purchaseMutation.isPending}
        >
          {purchaseMutation.isPending
            ? "Processing..."
            : `Pay ${currencyFormatter.format(totalAmount / 100)}`}
        </Button>
      </CardFooter>
    </Card>
  );
};
