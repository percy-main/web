import { useEffect, useRef } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { STRIPE_PUBLIC_KEY, SPONSORSHIP_PRICE_ID } from "astro:env/client";

const stripeClient = await loadStripe(STRIPE_PUBLIC_KEY);

export const Checkout = () => {
  const checkout = useRef<StripeEmbeddedCheckout>(undefined);

  useEffect(() => {
    async function onMount() {
      const urlParams = new URLSearchParams(window.location.search);
      const gameId = urlParams.get("game");

      const response = await fetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({
          priceId: SPONSORSHIP_PRICE_ID,
          gameId,
        }),
      });

      const { clientSecret } = await response.json();

      const checkoutInstance = await stripeClient!.initEmbeddedCheckout({
        clientSecret: clientSecret,
      });

      checkout.current = checkoutInstance;

      checkoutInstance.mount("#checkout");
    }

    onMount();

    return () => {
      checkout.current?.destroy();
    };
  }, []);

  return <div id="checkout" />;
};
