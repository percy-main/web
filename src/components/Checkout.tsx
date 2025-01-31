import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { actions } from "astro:actions";
import { STRIPE_PUBLIC_KEY } from "astro:env/client";
import { useEffect, useRef, useState, type FC } from "react";
import type { Price } from "../collections/price";

const stripeClient = await loadStripe(STRIPE_PUBLIC_KEY);

type Props = {
  price: Price;
};

export const Checkout: FC<Props> = ({ price }) => {
  const checkout = useRef<StripeEmbeddedCheckout>(undefined);

  const [error, setError] = useState<string>();

  useEffect(() => {
    async function onMount() {
      const urlParams = new URLSearchParams(window.location.search);

      const metadata = () => {
        const str = urlParams.get("metadata");

        if (!str) {
          return undefined;
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return JSON.parse(decodeURIComponent(str));
        } catch {
          return undefined;
        }
      };

      const emailStr = urlParams.get("email");
      const email = emailStr == null ? undefined : decodeURIComponent(emailStr);

      const response = await actions.checkout({
        price,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: metadata(),
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
