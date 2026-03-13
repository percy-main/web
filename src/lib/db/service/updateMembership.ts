import * as db from "@/lib/db/client";
import { defaultCategoryForMembershipType } from "@/lib/member/categories";
import { randomUUID } from "crypto";
import { add, type Duration } from "date-fns";

export const updateMembership = async ({
  membershipType,
  email,
  addedDuration,
  paidAt,
  paidUntil: explicitPaidUntil,
}: {
  membershipType: string;
  email: string;
  addedDuration: Duration;
  paidAt: Date;
  paidUntil?: Date;
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
      "member.member_category as member_category",
    ])
    .where("member.email", "=", email)
    .executeTakeFirst();

  if (!member) {
    // Create a minimal member record with just email so payment can proceed
    const newMemberId = randomUUID();
    await db.client
      .insertInto("member")
      .values({
        id: newMemberId,
        email,
      })
      .execute();

    const paid_until = explicitPaidUntil
      ? explicitPaidUntil.toISOString()
      : add(paidAt, addedDuration).toISOString();

    const membership = await db.client
      .insertInto("membership")
      .values({
        id: randomUUID(),
        type: membershipType,
        member_id: newMemberId,
        paid_until,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const category = defaultCategoryForMembershipType(membershipType);
    if (category) {
      await db.client
        .updateTable("member")
        .set({ member_category: category })
        .where("id", "=", newMemberId)
        .execute();
    }

    return {
      ...membership,
      name: null,
      isNew: true,
    };
  }

  console.log("Adding membership duration", addedDuration);

  if (!member.membership_id) {
    console.log("No existing membership for customer, creating membership ");

    const paid_until = explicitPaidUntil
      ? explicitPaidUntil.toISOString()
      : add(paidAt, addedDuration).toISOString();

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

    // Auto-derive member_category if not already set
    if (!member.member_category) {
      const category = defaultCategoryForMembershipType(membershipType);
      if (category) {
        await db.client
          .updateTable("member")
          .set({ member_category: category })
          .where("id", "=", member.member_id)
          .execute();
      }
    }

    return {
      ...membership,
      name: member.name,
      isNew: true,
    };
  } else {
    console.log(
      "Existing membership for customer, adding duration to previous paid_until ",
    );

    const paid_until = explicitPaidUntil
      ? explicitPaidUntil.toISOString()
      : add(
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

    // Auto-derive member_category if not already set
    if (!member.member_category) {
      const category = defaultCategoryForMembershipType(membershipType);
      if (category) {
        await db.client
          .updateTable("member")
          .set({ member_category: category })
          .where("id", "=", member.member_id)
          .execute();
      }
    }

    return {
      ...membership,
      name: member.name,
      isNew: false,
    };
  }
};
