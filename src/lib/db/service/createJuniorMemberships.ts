import * as db from "@/lib/db/client";
import { randomUUID } from "crypto";

/** Junior membership is valid until the end of the calendar year of purchase. */
const endOfYear = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), 11, 31)).toISOString();

export const createJuniorMemberships = async ({
  memberId,
  dependentIds,
  paidAt,
}: {
  memberId: string;
  dependentIds: string[];
  paidAt: Date;
}) => {
  console.log(
    "Creating junior memberships",
    JSON.stringify({ memberId, dependentIds, paidAt }, null, 2),
  );

  const paid_until = endOfYear(paidAt);

  for (const dependentId of dependentIds) {
    const existing = await db.client
      .selectFrom("membership")
      .select(["id", "paid_until"])
      .where("dependent_id", "=", dependentId)
      .where("type", "=", "junior")
      .executeTakeFirst();

    if (existing) {
      // If they already have a membership that extends beyond this year-end,
      // keep the later date; otherwise set to this year-end.
      const existingPaidUntil = new Date(existing.paid_until);
      const newPaidUntil =
        existingPaidUntil > new Date(paid_until)
          ? existing.paid_until
          : paid_until;

      await db.client
        .updateTable("membership")
        .set({ paid_until: newPaidUntil })
        .where("id", "=", existing.id)
        .execute();

      console.log(
        `Updated junior membership for dependent ${dependentId} to ${newPaidUntil}`,
      );
    } else {
      await db.client
        .insertInto("membership")
        .values({
          id: randomUUID(),
          type: "junior",
          member_id: memberId,
          dependent_id: dependentId,
          paid_until,
        })
        .execute();

      console.log(
        `Created junior membership for dependent ${dependentId} until ${paid_until}`,
      );
    }
  }
};
