import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import * as playCricketApi from "@/lib/play-cricket";
import { z } from "astro:schema";

export const playCricketAdmin = {
  getPlayCricketLinking: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const members = await client
        .selectFrom("member")
        .select(["id", "name", "play_cricket_id"])
        .orderBy("name", "asc")
        .execute();

      const dependents = await client
        .selectFrom("dependent")
        .innerJoin("member", "member.id", "dependent.member_id")
        .select([
          "dependent.id",
          "dependent.name",
          "dependent.play_cricket_id",
          "member.name as parentName",
        ])
        .orderBy("dependent.name", "asc")
        .execute();

      return {
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          playCricketId: m.play_cricket_id,
        })),
        dependents: dependents.map((d) => ({
          id: d.id,
          name: d.name,
          parentName: d.parentName,
          playCricketId: d.play_cricket_id,
        })),
      };
    },
  }),

  refreshPlayCricketPlayers: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const { players } = await playCricketApi.getPlayers();

      return {
        players: players.map((p) => ({
          memberId: p.member_id,
          name: p.name,
        })),
      };
    },
  }),

  linkPlayCricketPlayer: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      type: z.enum(["member", "dependent"]),
      id: z.string(),
      playCricketId: z.string().regex(/^\d+$/, "Play-Cricket ID must be numeric"),
    }),
    handler: async ({ type, id, playCricketId }) => {
      if (type === "member") {
        await client
          .updateTable("member")
          .set({ play_cricket_id: playCricketId })
          .where("id", "=", id)
          .execute();
      } else {
        await client
          .updateTable("dependent")
          .set({ play_cricket_id: playCricketId })
          .where("id", "=", id)
          .execute();
      }

      return { success: true };
    },
  }),

  unlinkPlayCricketPlayer: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      type: z.enum(["member", "dependent"]),
      id: z.string(),
    }),
    handler: async ({ type, id }) => {
      if (type === "member") {
        await client
          .updateTable("member")
          .set({ play_cricket_id: null })
          .where("id", "=", id)
          .execute();
      } else {
        await client
          .updateTable("dependent")
          .set({ play_cricket_id: null })
          .where("id", "=", id)
          .execute();
      }

      return { success: true };
    },
  }),
};
