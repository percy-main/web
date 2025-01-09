import { useEffect, useRef, useState, type FC } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { STRIPE_PUBLIC_KEY } from "astro:env/client";
import { actions } from "astro:actions";

const stripeClient = await loadStripe(STRIPE_PUBLIC_KEY);

type Props = {
  priceId: string;
};

export const Checkout: FC<Props> = ({ priceId }) => {
  const checkout = useRef<StripeEmbeddedCheckout>(undefined);

  const [error, setError] = useState<string>();

  useEffect(() => {
    async function onMount() {
      const urlParams = new URLSearchParams(window.location.search);

      const metadata = () => {
        const str = urlParams.get("metadata");

        if (!str) {
          return {};
        }

        try {
          return JSON.parse(str);
        } catch {
          return {};
        }
      };

      const response = await actions.checkout({
        priceId,
        metadata: metadata(),
      });

      if (response.error) {
        setError(`We encountered an error. Code: ${response.error.code}`);
        return;
      }

      const checkoutInstance = await stripeClient!.initEmbeddedCheckout({
        clientSecret: response.data.clientSecret,
      });

      checkout.current = checkoutInstance;

      checkoutInstance.mount("#checkout");
    }

    onMount();

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
