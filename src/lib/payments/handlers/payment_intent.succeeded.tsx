import { client } from "@/lib/db/client";
import { createJuniorMemberships } from "@/lib/db/service/createJuniorMemberships";
import { createPaymentCharge } from "@/lib/db/service/createPaymentCharge";
import { updateMembership } from "@/lib/db/service/updateMembership";
import { send } from "@/lib/email/send";
import { sendMessage } from "@/lib/slack/sendMessage";
import { stripeDate } from "@/lib/util/stripeDate";
import { render } from "@react-email/render";
import { BASE_URL } from "astro:env/client";
import type Stripe from "stripe";
import { MembershipCreated } from "~/emails/MembershipUpdated";
import { SponsorshipConfirmation } from "~/emails/SponsorshipConfirmation";
import { stripe } from "../client";
import { gameSponsoredSchema, membershipSchema } from "../metadata";

const handleCharges = async (event: Stripe.PaymentIntentSucceededEvent) => {
  const paymentIntentId = event.data.object.id;
  const paidAt = stripeDate(event.data.object.created);

  const charges = await client
    .selectFrom("charge")
    .where("stripe_payment_intent_id", "=", paymentIntentId)
    .where("paid_at", "is", null)
    .select(["id", "member_id"])
    .execute();

  if (charges.length === 0) {
    console.error(
      "payment_intent.succeeded: no unpaid charges found for payment intent",
      paymentIntentId,
    );
    return;
  }

  for (const charge of charges) {
    await client
      .updateTable("charge")
      .set({ paid_at: paidAt.toISOString() })
      .where("id", "=", charge.id)
      .where("paid_at", "is", null)
      .execute();
  }

  for (const charge of charges) {
    const linkedDependents = await client
      .selectFrom("charge_dependent")
      .where("charge_id", "=", charge.id)
      .select(["dependent_id"])
      .execute();

    if (linkedDependents.length > 0) {
      await createJuniorMemberships({
        memberId: charge.member_id,
        dependentIds: linkedDependents.map((d) => d.dependent_id),
        paidAt,
      });
    }
  }
};

const handleSponsorGame = async (
  event: Stripe.PaymentIntentSucceededEvent,
  gameId: string,
  sponsorshipId?: string,
) => {
  const paidAt = stripeDate(event.created);
  const email =
    event.data.object.metadata.email ?? event.data.object.receipt_email;

  if (sponsorshipId) {
    await client
      .updateTable("game_sponsorship")
      .set({
        paid_at: paidAt.toISOString(),
        stripe_payment_intent_id: event.data.object.id,
      })
      .where("id", "=", sponsorshipId)
      .execute();

    const sponsorship = await client
      .selectFrom("game_sponsorship")
      .where("id", "=", sponsorshipId)
      .select([
        "sponsor_name",
        "sponsor_email",
        "sponsor_message",
        "game_id",
      ])
      .executeTakeFirst();

    if (sponsorship) {
      await sendMessage(
        `Game ${gameId} was sponsored by ${sponsorship.sponsor_name}. Review at ${BASE_URL}/admin`,
      );

      await send({
        to: sponsorship.sponsor_email,
        subject: SponsorshipConfirmation.subject,
        html: await render(
          <SponsorshipConfirmation.component
            imageBaseUrl={`${BASE_URL}/images`}
            sponsorName={sponsorship.sponsor_name}
            gameId={gameId}
            message={sponsorship.sponsor_message ?? undefined}
          />,
          { pretty: true },
        ),
      });
    }
  } else {
    await sendMessage(`Game ${gameId} was sponsored`);
  }

  if (email) {
    await createPaymentCharge({
      memberEmail: email,
      description: "Game sponsorship",
      amountPence: event.data.object.amount,
      chargeDate: paidAt,
      type: "sponsorship",
      source: "webhook",
      stripePaymentIntentId: event.data.object.id,
    });
  }
};

const handleMembership = async (
  event: Stripe.PaymentIntentSucceededEvent,
  membershipType: string,
  email: string,
  priceId: string,
) => {
  const price = await stripe.prices.retrieve(priceId, {
    expand: ["product"],
  });

  // One-time membership purchases are always 12 months
  const addedDuration =
    price.type === "one_time"
      ? { months: 12 }
      : price.recurring
        ? { [`${price.recurring.interval}s`]: price.recurring.interval_count }
        : { days: 0 };

  const membership = await updateMembership({
    membershipType,
    email,
    addedDuration,
    paidAt: stripeDate(event.created),
  });

  await createPaymentCharge({
    memberEmail: email,
    description: `Membership payment - ${membershipType}`,
    amountPence: event.data.object.amount,
    chargeDate: stripeDate(event.created),
    type: "membership",
    source: "webhook",
    stripePaymentIntentId: event.data.object.id,
  });

  await send({
    to: email,
    subject: MembershipCreated.subject,
    html: await render(
      <MembershipCreated.component
        imageBaseUrl={`${BASE_URL}/images`}
        name={membership.name}
        type={membership.type ?? undefined}
        paid_until={membership.paid_until}
        isNew={membership.isNew}
      />,
      {
        pretty: true,
      },
    ),
  });
};

export const paymentIntentSucceeded = async (
  event: Stripe.PaymentIntentSucceededEvent,
) => {
  const { metadata } = event.data.object;

  if (metadata.type === "charges") {
    await handleCharges(event);
    return;
  }

  const sponsored = gameSponsoredSchema.safeParse(metadata);
  if (sponsored.success) {
    await handleSponsorGame(
      event,
      sponsored.data.gameId,
      sponsored.data.sponsorshipId,
    );
    return;
  }

  const membership = membershipSchema.safeParse(metadata);
  if (membership.success) {
    const email = metadata.email;
    const priceId = metadata.priceId;

    if (!email) {
      console.error(
        "payment_intent.succeeded: membership payment missing email in metadata",
        event.data.object.id,
      );
      return;
    }

    if (!priceId) {
      console.error(
        "payment_intent.succeeded: membership payment missing priceId in metadata",
        event.data.object.id,
      );
      return;
    }

    await handleMembership(
      event,
      membership.data.membership,
      email,
      priceId,
    );
    return;
  }
};
