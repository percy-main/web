import { Subscriptions } from "./Subscriptions";
import { Transactions } from "./Transactions";

export const Payments = () => (
  <section className="flex flex-col gap-8">
    <Subscriptions />
    <Transactions />
  </section>
);
