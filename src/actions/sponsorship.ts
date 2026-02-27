import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import * as playCricketApi from "@/lib/play-cricket";
import { stripe } from "@/lib/payments/client";
import { paymentData } from "@/lib/payments/config";
import { resolveStripeCustomer } from "@/lib/payments/resolveStripeCustomer";
import { ActionError, defineAction } from "astro:actions";
import { CONTEXT } from "astro:env/client";
import { DEPLOY_PRIME_URL, PLAY_CRICKET_SITE_ID } from "astro:env/server";
import { z } from "astro:schema";
import { randomUUID } from "crypto";
import type Stripe from "stripe";

const MAX_LOGO_SIZE_BYTES = 150_000;

export const sponsorship = {
  createPayment: defineAction({
    input: z.object({
      gameId: z.string(),
      sponsorName: z.string().min(1).max(200),
      sponsorEmail: z.string().email(),
      sponsorWebsite: z.string().url().optional().or(z.literal("")),
      sponsorLogoDataUrl: z.string().optional(),
      sponsorMessage: z.string().max(100).optional().or(z.literal("")),
    }),
    handler: async ({
      gameId,
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
            message: "Logo image is too large. Please use an image under 100KB.",
          });
        }

        const priceId = paymentData.prices.sponsorship;
        const price = await stripe.prices.retrieve(priceId, {
          expand: ["product"],
        });

        const product = price.product as Stripe.Product;
        const amount = price.unit_amount;

        if (!amount) {
          throw new ActionError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Sponsorship price not configured",
          });
        }

        const sponsorshipId = randomUUID();

        await client
          .insertInto("game_sponsorship")
          .values({
            id: sponsorshipId,
            game_id: gameId,
            sponsor_name: sponsorName,
            sponsor_email: sponsorEmail,
            sponsor_website: sponsorWebsite ?? null,
            sponsor_logo_url: sponsorLogoDataUrl ?? null,
            sponsor_message: sponsorMessage ?? null,
            amount_pence: amount,
          })
          .execute();

        const enrichedMetadata: Record<string, string> = {
          type: "sponsorGame",
          gameId,
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
          .updateTable("game_sponsorship")
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
        console.error(err);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create sponsorship payment",
        });
      }
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
        .selectFrom("game_sponsorship")
        .where("game_sponsorship.id", "is not", null);

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
        .selectFrom("game_sponsorship")
        .where("game_sponsorship.id", "is not", null);

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
          "game_sponsorship.id",
          "game_sponsorship.game_id",
          "game_sponsorship.sponsor_name",
          "game_sponsorship.sponsor_email",
          "game_sponsorship.sponsor_website",
          "game_sponsorship.sponsor_logo_url",
          "game_sponsorship.sponsor_message",
          "game_sponsorship.approved",
          "game_sponsorship.display_name",
          "game_sponsorship.amount_pence",
          "game_sponsorship.paid_at",
          "game_sponsorship.created_at",
          "game_sponsorship.notes",
        ])
        .orderBy("game_sponsorship.created_at", "desc")
        .limit(pageSize)
        .offset(offset)
        .execute();

      return {
        sponsorships: sponsorships.map((s) => ({
          id: s.id,
          gameId: s.game_id,
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
        .updateTable("game_sponsorship")
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
        .updateTable("game_sponsorship")
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
    }),
    handler: async ({ sponsorshipId, displayName, notes }) => {
      const updates: Record<string, string | null> = {};
      if (displayName !== undefined) {
        updates.display_name = displayName || null;
      }
      if (notes !== undefined) {
        updates.notes = notes || null;
      }

      if (Object.keys(updates).length > 0) {
        await client
          .updateTable("game_sponsorship")
          .set(updates)
          .where("id", "=", sponsorshipId)
          .execute();
      }

      return { success: true };
    },
  }),

  listGames: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      search: z.string().optional(),
      season: z.number().optional(),
    }),
    handler: async ({ search, season }) => {
      const now = new Date();
      const resolvedSeason =
        season ?? (now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear());

      const { matches } = await playCricketApi.getMatchesSummary({
        season: resolvedSeason,
      });

      let filtered = matches;
      if (search && search.trim().length > 0) {
        const lowerSearch = search.trim().toLowerCase();
        filtered = matches.filter((m) => {
          const isHome = m.home_club_id === PLAY_CRICKET_SITE_ID;
          const opposition = isHome
            ? `${m.away_club_name} ${m.away_team_name}`
            : `${m.home_club_name} ${m.home_team_name}`;
          return opposition.toLowerCase().includes(lowerSearch);
        });
      }

      return {
        games: filtered.slice(0, 50).map((m) => {
          const isHome = m.home_club_id === PLAY_CRICKET_SITE_ID;
          const ourTeam = isHome
            ? m.home_team_name
            : m.away_team_name;
          const opposition = isHome
            ? `${m.away_club_name} ${m.away_team_name}`
            : `${m.home_club_name} ${m.home_team_name}`;
          return {
            id: m.id.toString(),
            date: m.match_date,
            team: ourTeam,
            opposition,
            home: isHome,
          };
        }),
      };
    },
  }),

  createManual: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      gameId: z.string().min(1),
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
      gameId,
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
          message: "Logo image is too large. Please use an image under 150KB.",
        });
      }

      const sponsorshipId = randomUUID();

      await client
        .insertInto("game_sponsorship")
        .values({
          id: sponsorshipId,
          game_id: gameId,
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
