import * as db from "@/lib/db/client";
import { randomUUID } from "crypto";
import { add, type Duration } from "date-fns";
import { NoMemberWithEmailError } from "./errors";

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
  const member = await db.client
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
      "member.name as name",
    ])
    .where("member.email", "=", email)
    .executeTakeFirst();

  if (!member) {
    throw new NoMemberWithEmailError({ email });
  }

  console.log("Adding membership duration", addedDuration);

  if (!member.membership_id) {
    console.log("No existing membership for customer, creating membership ");

    const paid_until = add(paidAt, addedDuration).toISOString();

    const membership = await db.client
      .insertInto("membership")
      .values({
        id: randomUUID(),
        type: membershipType,
        member_id: member.member_id,
        paid_until,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...membership,
      name: member.name,
      isNew: true,
    };
  } else {
    console.log(
      "Existing membership for customer, adding duration to previous paid_until ",
    );

    const paid_until = add(
      member.paid_until ? new Date(member.paid_until) : paidAt,
      addedDuration,
    ).toISOString();

    const membership = await db.client
      .updateTable("membership")
      .set({
        paid_until,
      })
      .where("id", "=", member.membership_id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...membership,
      name: member.name,
      isNew: false,
    };
  }
};
