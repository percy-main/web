import { defineAuthAction } from "@/lib/auth/api";
import { currentCricketSeason } from "@/lib/cricket-season";
import { client } from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { paymentData } from "@/lib/payments/config";
import { resolveStripeCustomer } from "@/lib/payments/resolveStripeCustomer";
import { ActionError, defineAction } from "astro:actions";
import { CONTEXT } from "astro:env/client";
import { DEPLOY_PRIME_URL } from "astro:env/server";
import { z } from "astro:schema";
import { randomUUID } from "crypto";
import type Stripe from "stripe";

const MAX_LOGO_SIZE_BYTES = 150_000;

export const playerSponsorship = {
  createPayment: defineAction({
    input: z.object({
      contentfulEntryId: z.string(),
      playerName: z.string(),
      sponsorName: z.string().min(1).max(200),
      sponsorEmail: z.string().email(),
      sponsorWebsite: z.string().url().optional().or(z.literal("")),
      sponsorLogoDataUrl: z.string().optional(),
      sponsorMessage: z.string().max(100).optional().or(z.literal("")),
    }),
    handler: async ({
      contentfulEntryId,
      playerName,
      sponsorName,
      sponsorEmail,
      sponsorWebsite,
      sponsorLogoDataUrl,
      sponsorMessage,
    }) => {
      try {
        if (
          sponsorLogoDataUrl &&
          sponsorLogoDataUrl.length > MAX_LOGO_SIZE_BYTES
        ) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message:
              "Logo image is too large. Please use an image under 150KB.",
          });
        }

        const season = currentCricketSeason();

        // Check if player already has an active sponsorship for this season
        const existing = await client
          .selectFrom("player_sponsorship")
          .where("contentful_entry_id", "=", contentfulEntryId)
          .where("season", "=", season)
          .where("paid_at", "is not", null)
          .select(["id"])
          .executeTakeFirst();

        if (existing) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message:
              "This player already has a sponsor for this season.",
          });
        }

        const priceId = paymentData.prices.playerSponsorship;
        const price = await stripe.prices.retrieve(priceId, {
          expand: ["product"],
        });

        const product = price.product as Stripe.Product;
        const amount = price.unit_amount;

        if (!amount) {
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Player sponsorship price not configured",
          });
        }

        const sponsorshipId = randomUUID();

        await client
          .insertInto("player_sponsorship")
          .values({
            id: sponsorshipId,
            contentful_entry_id: contentfulEntryId,
            player_name: playerName,
            season,
            sponsor_name: sponsorName,
            sponsor_email: sponsorEmail,
            sponsor_website: sponsorWebsite ?? null,
            sponsor_logo_url: sponsorLogoDataUrl ?? null,
            sponsor_message: sponsorMessage ?? null,
            amount_pence: amount,
          })
          .execute();

        const enrichedMetadata: Record<string, string> = {
          type: "sponsorPlayer",
          contentfulEntryId,
          sponsorshipId,
          email: sponsorEmail,
          ...(CONTEXT !== "production" && DEPLOY_PRIME_URL
            ? { deployPreviewUrl: DEPLOY_PRIME_URL }
            : {}),
        };

        const customerId = await resolveStripeCustomer(sponsorEmail);

        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: price.currency,
          automatic_payment_methods: { enabled: true },
          ...(customerId ? { customer: customerId } : {}),
          metadata: enrichedMetadata,
        });

        if (!paymentIntent.client_secret) {
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not create payment",
          });
        }

        await client
          .updateTable("player_sponsorship")
          .set({ stripe_payment_intent_id: paymentIntent.id })
          .where("id", "=", sponsorshipId)
          .execute();

        return {
          clientSecret: paymentIntent.client_secret,
          amount,
          productName: product.name,
        };
      } catch (err) {
        if (err instanceof ActionError) throw err;
        // Handle unique constraint violation (race condition: two concurrent payments)
        if (
          err instanceof Error &&
          err.message.includes("UNIQUE constraint failed")
        ) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "This player already has a sponsor for this season.",
          });
        }
        console.error(err);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create player sponsorship payment",
        });
      }
    },
  }),

  getForPlayer: defineAction({
    input: z.object({
      contentfulEntryId: z.string(),
    }),
    handler: async ({ contentfulEntryId }) => {
      const season = currentCricketSeason();

      const sponsorship = await client
        .selectFrom("player_sponsorship")
        .where("contentful_entry_id", "=", contentfulEntryId)
        .where("season", "=", season)
        .where("approved", "=", 1)
        .where("paid_at", "is not", null)
        .select([
          "id",
          "sponsor_name",
          "display_name",
          "sponsor_website",
          "sponsor_logo_url",
          "sponsor_message",
        ])
        .executeTakeFirst();

      if (!sponsorship) return null;

      return {
        id: sponsorship.id,
        sponsorName: sponsorship.display_name ?? sponsorship.sponsor_name,
        sponsorWebsite: sponsorship.sponsor_website,
        sponsorLogoUrl: sponsorship.sponsor_logo_url,
        sponsorMessage: sponsorship.sponsor_message,
      };
    },
  }),

  hasPending: defineAction({
    input: z.object({
      contentfulEntryId: z.string(),
    }),
    handler: async ({ contentfulEntryId }) => {
      const season = currentCricketSeason();

      const pending = await client
        .selectFrom("player_sponsorship")
        .where("contentful_entry_id", "=", contentfulEntryId)
        .where("season", "=", season)
        .where((eb) =>
          eb.or([
            eb("paid_at", "is", null),
            eb.and([eb("paid_at", "is not", null), eb("approved", "=", 0)]),
          ]),
        )
        .select(["id"])
        .executeTakeFirst();

      return { hasPending: !!pending };
    },
  }),

  getAllApproved: defineAction({
    input: z.object({
      season: z.number().optional(),
    }),
    handler: async ({ season }) => {
      const resolvedSeason = season ?? currentCricketSeason();

      const sponsorships = await client
        .selectFrom("player_sponsorship")
        .where("season", "=", resolvedSeason)
        .where("approved", "=", 1)
        .where("paid_at", "is not", null)
        .select([
          "contentful_entry_id",
          "sponsor_name",
          "display_name",
          "sponsor_website",
        ])
        .execute();

      return sponsorships.map((s) => ({
        contentfulEntryId: s.contentful_entry_id,
        sponsorName: s.display_name ?? s.sponsor_name,
        sponsorWebsite: s.sponsor_website,
      }));
    },
  }),

  list: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      filter: z
        .enum(["all", "pending_payment", "pending_approval", "approved"])
        .optional(),
    }),
    handler: async ({ page, pageSize, filter }) => {
      let baseQuery = client
        .selectFrom("player_sponsorship")
        .where("player_sponsorship.id", "is not", null);

      if (filter === "pending_payment") {
        baseQuery = baseQuery.where("paid_at", "is", null);
      } else if (filter === "pending_approval") {
        baseQuery = baseQuery
          .where("paid_at", "is not", null)
          .where("approved", "=", 0);
      } else if (filter === "approved") {
        baseQuery = baseQuery.where("approved", "=", 1);
      }

      const countResult = await baseQuery
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirstOrThrow();

      const total = Number(countResult.total);
      const offset = (page - 1) * pageSize;

      let query = client
        .selectFrom("player_sponsorship")
        .where("player_sponsorship.id", "is not", null);

      if (filter === "pending_payment") {
        query = query.where("paid_at", "is", null);
      } else if (filter === "pending_approval") {
        query = query
          .where("paid_at", "is not", null)
          .where("approved", "=", 0);
      } else if (filter === "approved") {
        query = query.where("approved", "=", 1);
      }

      const sponsorships = await query
        .select([
          "player_sponsorship.id",
          "player_sponsorship.contentful_entry_id",
          "player_sponsorship.player_name",
          "player_sponsorship.season",
          "player_sponsorship.sponsor_name",
          "player_sponsorship.sponsor_email",
          "player_sponsorship.sponsor_website",
          "player_sponsorship.sponsor_logo_url",
          "player_sponsorship.sponsor_message",
          "player_sponsorship.approved",
          "player_sponsorship.display_name",
          "player_sponsorship.amount_pence",
          "player_sponsorship.paid_at",
          "player_sponsorship.created_at",
          "player_sponsorship.notes",
        ])
        .orderBy("player_sponsorship.created_at", "desc")
        .limit(pageSize)
        .offset(offset)
        .execute();

      return {
        sponsorships: sponsorships.map((s) => ({
          id: s.id,
          contentfulEntryId: s.contentful_entry_id,
          playerName: s.player_name,
          season: s.season,
          sponsorName: s.sponsor_name,
          sponsorEmail: s.sponsor_email,
          sponsorWebsite: s.sponsor_website,
          sponsorLogoUrl: s.sponsor_logo_url,
          sponsorMessage: s.sponsor_message,
          approved: s.approved === 1,
          displayName: s.display_name,
          amountPence: s.amount_pence,
          paidAt: s.paid_at,
          createdAt: s.created_at,
          notes: s.notes,
        })),
        total,
        page,
        pageSize,
      };
    },
  }),

  approve: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      sponsorshipId: z.string(),
    }),
    handler: async ({ sponsorshipId }) => {
      await client
        .updateTable("player_sponsorship")
        .set({ approved: 1 })
        .where("id", "=", sponsorshipId)
        .execute();

      return { success: true };
    },
  }),

  reject: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      sponsorshipId: z.string(),
    }),
    handler: async ({ sponsorshipId }) => {
      await client
        .updateTable("player_sponsorship")
        .set({ approved: 0 })
        .where("id", "=", sponsorshipId)
        .execute();

      return { success: true };
    },
  }),

  update: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      sponsorshipId: z.string(),
      displayName: z.string().optional(),
      notes: z.string().optional(),
      sponsorLogoDataUrl: z.string().nullable().optional(),
    }),
    handler: async ({ sponsorshipId, displayName, notes, sponsorLogoDataUrl }) => {
      if (
        sponsorLogoDataUrl &&
        sponsorLogoDataUrl.length > MAX_LOGO_SIZE_BYTES
      ) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Logo image is too large. Please use an image under 150KB.",
        });
      }

      const updates: Record<string, string | null> = {};
      if (displayName !== undefined) {
        updates.display_name = displayName || null;
      }
      if (notes !== undefined) {
        updates.notes = notes || null;
      }
      if (sponsorLogoDataUrl !== undefined) {
        updates.sponsor_logo_url = sponsorLogoDataUrl;
      }

      if (Object.keys(updates).length > 0) {
        await client
          .updateTable("player_sponsorship")
          .set(updates)
          .where("id", "=", sponsorshipId)
          .execute();
      }

      return { success: true };
    },
  }),

  createManual: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      contentfulEntryId: z.string().min(1),
      playerName: z.string().min(1),
      sponsorName: z.string().min(1).max(200),
      sponsorEmail: z.string().email(),
      sponsorWebsite: z.string().url().optional().or(z.literal("")),
      sponsorLogoDataUrl: z.string().optional(),
      sponsorMessage: z.string().max(100).optional().or(z.literal("")),
      amountPence: z.number().int().min(0),
      displayName: z.string().optional().or(z.literal("")),
      notes: z.string().optional().or(z.literal("")),
    }),
    handler: async ({
      contentfulEntryId,
      playerName,
      sponsorName,
      sponsorEmail,
      sponsorWebsite,
      sponsorLogoDataUrl,
      sponsorMessage,
      amountPence,
      displayName,
      notes,
    }) => {
      if (
        sponsorLogoDataUrl &&
        sponsorLogoDataUrl.length > MAX_LOGO_SIZE_BYTES
      ) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message:
            "Logo image is too large. Please use an image under 150KB.",
        });
      }

      const season = currentCricketSeason();
      const sponsorshipId = randomUUID();

      await client
        .insertInto("player_sponsorship")
        .values({
          id: sponsorshipId,
          contentful_entry_id: contentfulEntryId,
          player_name: playerName,
          season,
          sponsor_name: sponsorName,
          sponsor_email: sponsorEmail,
          sponsor_website: sponsorWebsite ?? null,
          sponsor_logo_url: sponsorLogoDataUrl ?? null,
          sponsor_message: sponsorMessage ?? null,
          amount_pence: amountPence,
          approved: 1,
          paid_at: new Date().toISOString(),
          display_name: displayName ?? null,
          notes: notes ?? null,
        })
        .execute();

      return { sponsorshipId };
    },
  }),
};
