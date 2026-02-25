import * as db from "@/lib/db/client";
import { randomUUID } from "crypto";
import { add } from "date-fns";

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

  const paid_until = add(paidAt, { months: 12 }).toISOString();

  for (const dependentId of dependentIds) {
    const existing = await db.client
      .selectFrom("membership")
      .select(["id", "paid_until"])
      .where("dependent_id", "=", dependentId)
      .where("type", "=", "junior")
      .executeTakeFirst();

    if (existing) {
      const existingPaidUntil = new Date(existing.paid_until);
      const newPaidUntil = add(
        existingPaidUntil > paidAt ? existingPaidUntil : paidAt,
        { months: 12 },
      ).toISOString();

      await db.client
        .updateTable("membership")
        .set({ paid_until: newPaidUntil })
        .where("id", "=", existing.id)
        .execute();

      console.log(
        `Extended junior membership for dependent ${dependentId} to ${newPaidUntil}`,
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
