import { defineAuthAction } from "../lib/auth/api";
import { client } from "../lib/db/client";

export const membership = defineAuthAction({
  requireVerifiedEmail: true,
  handler: async (_, { user }) => {
    try {
      const membership = await client
        .selectFrom("membership")
        .leftJoin("member", "member.id", "membership.member_id")
        .where("member.email", "=", user.email)
        .select([
          "membership.id",
          "membership.type",
          "membership.paid_until",
          "membership.created_at",
        ])
        .executeTakeFirst();

      return {
        membership,
      };
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
});
