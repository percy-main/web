import { defineAuthAction } from "@/lib/auth/api";
import { contentClient } from "@/lib/contentful/client";
import { client } from "@/lib/db/client";
import * as playCricketApi from "@/lib/play-cricket";
import type { TypeTrusteeSkeleton } from "@/__generated__";
import type { Asset, AssetDetails } from "contentful";
import { z } from "astro:schema";

export const recordLinking = {
  /** Fetch all members and dependents with their link statuses across sources. */
  getRecordLinking: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const members = await client
        .selectFrom("member")
        .select(["id", "name", "play_cricket_id", "contentful_entry_id"])
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
          contentfulEntryId: m.contentful_entry_id,
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

  /** Fetch Play-Cricket players from the API. */
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

  /** Fetch Contentful person entries for linking. */
  getContentfulPersons: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const response = await contentClient.getEntries<TypeTrusteeSkeleton>({
        content_type: "trustee",
        limit: 500,
      });

      return {
        persons: response.items.map((item) => {
          const photo = item.fields.photo as Asset | undefined;
          const photoDetails =
            photo &&
            (photo.fields.file?.details as AssetDetails | undefined);
          return {
            id: item.sys.id,
            name: item.fields.name,
            slug: item.fields.slug,
            photoUrl: (() => {
              const fileUrl = photo?.fields.file?.url;
              if (typeof fileUrl !== "string") return null;
              return `https:${fileUrl}`;
            })(),
            photoWidth: photoDetails?.image?.width ?? null,
            photoHeight: photoDetails?.image?.height ?? null,
          };
        }),
      };
    },
  }),

  /** Link a member or dependent to a Play-Cricket player ID. */
  linkPlayCricketPlayer: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      type: z.enum(["member", "dependent"]),
      id: z.string(),
      playCricketId: z
        .string()
        .regex(/^\d+$/, "Play-Cricket ID must be numeric"),
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

  /** Unlink a member or dependent from their Play-Cricket player ID. */
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

  /** Link a member to a Contentful person entry. */
  linkContentfulPerson: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
      contentfulEntryId: z.string(),
    }),
    handler: async ({ memberId, contentfulEntryId }) => {
      await client
        .updateTable("member")
        .set({ contentful_entry_id: contentfulEntryId })
        .where("id", "=", memberId)
        .execute();

      return { success: true };
    },
  }),

  /** Unlink a member from their Contentful person entry. */
  unlinkContentfulPerson: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      memberId: z.string(),
    }),
    handler: async ({ memberId }) => {
      await client
        .updateTable("member")
        .set({ contentful_entry_id: null })
        .where("id", "=", memberId)
        .execute();

      return { success: true };
    },
  }),
};
