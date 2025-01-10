import { stripe } from "../client";
import { type TypeGameFields } from "@/__generated__";
import { CDN_SPACE_ID } from "astro:env/server";
import stripeData from "~/stripe.json";
import { managementClient } from "../../contentful/client";

export const paymentSucceeded = async (sessionId: string) => {
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  const gameId = checkoutSession.metadata?.gameId;

  if (
    checkoutSession.payment_status === "paid" &&
    checkoutSession.line_items?.data.some(
      (li) => li.price?.id === stripeData.prices.sponsorship.priceId,
    ) &&
    typeof gameId === "string"
  ) {
    const gameEntry = await managementClient.entry.get<TypeGameFields>({
      entryId: gameId,
      spaceId: CDN_SPACE_ID,
      environmentId: "master",
    });

    if (!gameEntry) {
      console.error(`Missing game entry ${gameId}`);
      return;
    }

    if (gameEntry.fields.sponsor) {
      console.error(`Game entry ${gameId} already has a sponsor`);
      return;
    }

    const updated = await managementClient.entry.patch(
      {
        entryId: gameId,
        spaceId: CDN_SPACE_ID,
        environmentId: "master",
      },
      [{ op: "replace", path: "/fields/hasSponsor/en-US", value: true }],
      {
        "X-Contentful-Version": gameEntry.sys.version,
      },
    );

    await managementClient.entry.publish(
      {
        entryId: gameId,
        spaceId: CDN_SPACE_ID,
        environmentId: "master",
      },
      updated,
    );
  }
};
