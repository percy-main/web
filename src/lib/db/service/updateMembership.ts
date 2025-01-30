import * as db from "@/lib/db/client";
import { randomUUID } from "crypto";
import { add, type Duration } from "date-fns";

export const updateMembership = async ({
  membershipType,
  email,
  addedDuration,
  paidAt,
}: {
  membershipType: string;
  email: string;
  addedDuration: Duration;
  paidAt: Date;
}) => {
  console.log(
    "Updating membership",
    JSON.stringify(
      {
        membershipType,
        email,
        addedDuration,
        paidAt,
      },
      null,
      2,
    ),
  );
  const customer = await db.client
    .selectFrom("member")
    .leftJoin("membership", (join) =>
      join
        .onRef("member.id", "=", "membership.member_id")
        .on("membership.type", "=", membershipType),
    )
    .select([
      "member.id as member_id",
      "membership.id as membership_id",
      "membership.paid_until as paid_until",
    ])
    .where("member.email", "=", email)
    .executeTakeFirst();

  if (!customer) {
    console.log(`No customer with email`, { email });
    return;
  }

  console.log("Adding membership duration", addedDuration);

  if (!customer.membership_id) {
    console.log("No existing membership for customer, creating membership ");

    const paid_until = add(paidAt, addedDuration).toISOString();

    await db.client
      .insertInto("membership")
      .values({
        id: randomUUID(),
        type: membershipType,
        member_id: customer.member_id,
        paid_until,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
  } else {
    console.log(
      "Existing membership for customer, adding duration to previous paid_until ",
    );

    const paid_until = add(
      customer.paid_until ? new Date(customer.paid_until) : paidAt,
      addedDuration,
    ).toISOString();

    await db.client
      .updateTable("membership")
      .set({
        paid_until,
      })
      .where("id", "=", customer.membership_id)
      .execute();
  }
};
