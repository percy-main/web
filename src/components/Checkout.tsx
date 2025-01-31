import type { Price } from "@/collections/price";
import { useSearchParam } from "@/hooks/useSearchParams";
import { metadata as metadataSchema } from "@/lib/payments/metadata";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { actions } from "astro:actions";
import { STRIPE_PUBLIC_KEY } from "astro:env/client";
import { z } from "astro:schema";
import { useEffect, useRef, useState, type FC } from "react";

const stripeClient = await loadStripe(STRIPE_PUBLIC_KEY);

type Props = {
  price: Price;
};

export const Checkout: FC<Props> = ({ price }) => {
  const checkout = useRef<StripeEmbeddedCheckout>(undefined);

  const [error, setError] = useState<string>();

  const metadata = useSearchParam({
    param: "metadata",
    parse: (val) => JSON.parse(val) as unknown,
    schema: metadataSchema,
  });

  const email = useSearchParam({
    param: "email",
    schema: z.string().optional(),
  });

  useEffect(() => {
    async function onMount() {
      const response = await actions.checkout({
        price,
        metadata,
        email,
      });

      if (response.error) {
        setError(`We encountered an error. Code: ${response.error.code}`);
        return;
      }

      const checkoutInstance = await stripeClient?.initEmbeddedCheckout({
        clientSecret: response.data.clientSecret,
      });

      checkout.current = checkoutInstance;

      checkoutInstance?.mount("#checkout");
    }

    void onMount();

    return () => {
      checkout.current?.destroy();
    };
  }, []);

  if (error) {
    return (
      <div>Sorry, we encountered an error creating your checkout page.</div>
    );
  }

  return <div id="checkout" />;
};
