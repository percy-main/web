import stripeJson from "~/stripe.json";

export const paymentData = import.meta.env.DEV
  ? stripeJson.dev
  : stripeJson.default;
