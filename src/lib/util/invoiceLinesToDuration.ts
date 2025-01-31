import type { Duration } from "date-fns";
import type Stripe from "stripe";
import { addDurations } from "./addDuration";

export const invoiceLinesToDuration = (
  lineItems: Stripe.InvoiceLineItem[] | Stripe.LineItem[],
) =>
  lineItems
    .map((li): Duration => {
      // One time member purchases are always for 12 months
      if (li.price?.type === "one_time") {
        return {
          months: 12,
        };
      }

      if (li.price?.recurring?.interval) {
        return {
          [`${li.price.recurring.interval}s`]:
            li.price.recurring.interval_count,
        };
      }

      return {
        days: 0,
      };
    })
    .reduce(addDurations, { days: 0 });
