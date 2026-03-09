import { defineAuthAction } from "@/lib/auth/api";
import { client } from "@/lib/db/client";
import { stripe } from "@/lib/payments/client";
import { paymentData } from "@/lib/payments/config";
import { z } from "astro:schema";
import { subHours } from "date-fns";
import { sql } from "kysely";

const ABANDONED_THRESHOLD_HOURS = 1;

// Map Stripe product IDs to membership type labels
const productToMembershipType: Record<string, string> = {
  [paymentData.product.subs_player]: "senior_player",
  [paymentData.product.subs_social]: "social",
  [paymentData.product.subs_concessionary]: "concessionary",
  [paymentData.product.subs_women_player]: "senior_women_player",
};

const dateRangeInput = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const treasurer = {
  getIncomeByMonth: defineAuthAction({
    roles: ["admin"],
    input: dateRangeInput,
    handler: async ({ dateFrom, dateTo }) => {
      // 1. Income from the charge table (membership, donations, manual, etc.)
      let chargeQuery = client
        .selectFrom("charge")
        .where("charge.paid_at", "is not", null)
        .where("charge.deleted_at", "is", null);

      if (dateFrom) chargeQuery = chargeQuery.where("charge.paid_at", ">=", dateFrom);
      if (dateTo) chargeQuery = chargeQuery.where("charge.paid_at", "<=", dateTo);

      const chargeRows = await chargeQuery
        .select([
          sql<string>`strftime('%Y-%m', charge.paid_at)`.as("month"),
          "charge.type",
          sql<number>`SUM(charge.amount_pence)`.as("total"),
        ])
        .groupBy([sql`strftime('%Y-%m', charge.paid_at)`, "charge.type"])
        .orderBy(sql`strftime('%Y-%m', charge.paid_at)`, "asc")
        .execute();

      // 2. Sponsorship income from game_sponsorship + player_sponsorship tables
      let gameSponQuery = client
        .selectFrom("game_sponsorship")
        .where("game_sponsorship.paid_at", "is not", null);
      if (dateFrom) gameSponQuery = gameSponQuery.where("game_sponsorship.paid_at", ">=", dateFrom);
      if (dateTo) gameSponQuery = gameSponQuery.where("game_sponsorship.paid_at", "<=", dateTo);

      let playerSponQuery = client
        .selectFrom("player_sponsorship")
        .where("player_sponsorship.paid_at", "is not", null);
      if (dateFrom) playerSponQuery = playerSponQuery.where("player_sponsorship.paid_at", ">=", dateFrom);
      if (dateTo) playerSponQuery = playerSponQuery.where("player_sponsorship.paid_at", "<=", dateTo);

      const [gameSponRows, playerSponRows] = await Promise.all([
        gameSponQuery
          .select([
            sql<string>`strftime('%Y-%m', game_sponsorship.paid_at)`.as("month"),
            sql<number>`SUM(game_sponsorship.amount_pence)`.as("total"),
          ])
          .groupBy(sql`strftime('%Y-%m', game_sponsorship.paid_at)`)
          .execute(),
        playerSponQuery
          .select([
            sql<string>`strftime('%Y-%m', player_sponsorship.paid_at)`.as("month"),
            sql<number>`SUM(player_sponsorship.amount_pence)`.as("total"),
          ])
          .groupBy(sql`strftime('%Y-%m', player_sponsorship.paid_at)`)
          .execute(),
      ]);

      // Pivot into { month, membership, sponsorship, donation, manual, other }
      const monthMap = new Map<
        string,
        { month: string; membership: number; sponsorship: number; donation: number; manual: number; other: number }
      >();

      function getOrCreate(month: string) {
        let entry = monthMap.get(month);
        if (!entry) {
          entry = { month, membership: 0, sponsorship: 0, donation: 0, manual: 0, other: 0 };
          monthMap.set(month, entry);
        }
        return entry;
      }

      for (const row of chargeRows) {
        const entry = getOrCreate(row.month);
        const chargeType = row.type ?? "other";
        const total = Number(row.total);

        if (chargeType === "membership" || chargeType === "junior_membership") {
          entry.membership += total;
        } else if (chargeType === "sponsorship") {
          entry.sponsorship += total;
        } else if (chargeType === "donation") {
          entry.donation += total;
        } else if (chargeType === "manual") {
          entry.manual += total;
        } else {
          entry.other += total;
        }
      }

      // Add sponsorship table revenue
      for (const row of gameSponRows) {
        getOrCreate(row.month).sponsorship += Number(row.total);
      }
      for (const row of playerSponRows) {
        getOrCreate(row.month).sponsorship += Number(row.total);
      }

      // Sort by month
      return Array.from(monthMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      );
    },
  }),

  getMembershipSummary: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      const now = new Date().toISOString().split("T")[0];

      const rows = await client
        .selectFrom("membership")
        .where("membership.dependent_id", "is", null)
        .select([
          "membership.type",
          sql<number>`COUNT(CASE WHEN membership.paid_until >= ${now} THEN 1 END)`.as("active"),
          sql<number>`COUNT(CASE WHEN membership.paid_until IS NULL OR membership.paid_until < ${now} THEN 1 END)`.as("lapsed"),
        ])
        .groupBy("membership.type")
        .execute();

      return rows.map((r) => ({
        type: r.type ?? "unknown",
        active: Number(r.active),
        lapsed: Number(r.lapsed),
      }));
    },
  }),

  getMembershipPrices: defineAuthAction({
    roles: ["admin"],
    handler: async () => {
      // Fetch both annual (one-time) and monthly (recurring) prices for each membership product
      const results = await Promise.all(
        Object.entries(productToMembershipType).map(
          async ([productId, membershipType]) => {
            try {
              const [oneTimePrices, recurringPrices] = await Promise.all([
                stripe.prices.list({
                  product: productId,
                  active: true,
                  type: "one_time",
                  limit: 1,
                }),
                stripe.prices.list({
                  product: productId,
                  active: true,
                  type: "recurring",
                  limit: 1,
                }),
              ]);

              const annualPence =
                oneTimePrices.data.length > 0
                  ? (oneTimePrices.data[0].unit_amount ?? null)
                  : null;
              const monthlyPence =
                recurringPrices.data.length > 0
                  ? (recurringPrices.data[0].unit_amount ?? null)
                  : null;

              if (annualPence !== null || monthlyPence !== null) {
                return { type: membershipType, annualPence, monthlyPence };
              }
            } catch {
              // Skip if product not found
            }
            return null;
          },
        ),
      );

      return results.filter(
        (r): r is {
          type: string;
          annualPence: number | null;
          monthlyPence: number | null;
        } => r !== null,
      );
    },
  }),

  getOutstandingPayments: defineAuthAction({
    roles: ["admin"],
    input: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
    }),
    handler: async ({ page, pageSize }) => {
      const abandonedCutoff = subHours(
        new Date(),
        ABANDONED_THRESHOLD_HOURS,
      ).toISOString();

      const baseQuery = client
        .selectFrom("charge")
        .innerJoin("member", "member.id", "charge.member_id")
        .where("charge.paid_at", "is", null)
        .where("charge.deleted_at", "is", null)
        // Exclude pending (in-flight Stripe payments)
        .where("charge.payment_confirmed_at", "is", null)
        // Exclude abandoned (Stripe PI that's been pending > threshold)
        .where((eb) =>
          eb.or([
            eb("charge.stripe_payment_intent_id", "is", null),
            eb("charge.created_at", ">=", abandonedCutoff),
          ]),
        );

      const [charges, countResult] = await Promise.all([
        baseQuery
          .select([
            "charge.id",
            "charge.description",
            "charge.amount_pence",
            "charge.charge_date",
            "member.name as memberName",
            "member.email as memberEmail",
          ])
          .orderBy("charge.charge_date", "asc")
          .offset((page - 1) * pageSize)
          .limit(pageSize)
          .execute(),
        baseQuery
          .select(sql<number>`COUNT(*)`.as("total"))
          .executeTakeFirstOrThrow(),
      ]);

      return {
        charges: charges.map((c) => ({
          ...c,
          amountPence: c.amount_pence,
          chargeDate: c.charge_date,
          daysOverdue: Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(c.charge_date).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          ),
        })),
        total: Number(countResult.total),
      };
    },
  }),

  getSponsorshipSummary: defineAuthAction({
    roles: ["admin"],
    input: dateRangeInput,
    handler: async ({ dateFrom, dateTo }) => {
      // Game sponsorships
      let gameQuery = client.selectFrom("game_sponsorship");
      if (dateFrom)
        gameQuery = gameQuery.where("game_sponsorship.created_at", ">=", dateFrom);
      if (dateTo)
        gameQuery = gameQuery.where("game_sponsorship.created_at", "<=", dateTo);

      const gameResult = await gameQuery
        .select([
          sql<number>`COALESCE(SUM(game_sponsorship.amount_pence), 0)`.as("totalRevenue"),
          sql<number>`COUNT(CASE WHEN game_sponsorship.paid_at IS NOT NULL THEN 1 END)`.as("paidCount"),
          sql<number>`COUNT(CASE WHEN game_sponsorship.paid_at IS NULL THEN 1 END)`.as("unpaidCount"),
          sql<number>`COALESCE(SUM(CASE WHEN game_sponsorship.paid_at IS NOT NULL THEN game_sponsorship.amount_pence ELSE 0 END), 0)`.as("paidRevenue"),
        ])
        .executeTakeFirstOrThrow();

      // Player sponsorships
      let playerQuery = client.selectFrom("player_sponsorship");
      if (dateFrom)
        playerQuery = playerQuery.where("player_sponsorship.created_at", ">=", dateFrom);
      if (dateTo)
        playerQuery = playerQuery.where("player_sponsorship.created_at", "<=", dateTo);

      const playerResult = await playerQuery
        .select([
          sql<number>`COALESCE(SUM(player_sponsorship.amount_pence), 0)`.as("totalRevenue"),
          sql<number>`COUNT(CASE WHEN player_sponsorship.paid_at IS NOT NULL THEN 1 END)`.as("paidCount"),
          sql<number>`COUNT(CASE WHEN player_sponsorship.paid_at IS NULL THEN 1 END)`.as("unpaidCount"),
          sql<number>`COALESCE(SUM(CASE WHEN player_sponsorship.paid_at IS NOT NULL THEN player_sponsorship.amount_pence ELSE 0 END), 0)`.as("paidRevenue"),
        ])
        .executeTakeFirstOrThrow();

      return {
        game: {
          totalRevenue: Number(gameResult.totalRevenue),
          paidRevenue: Number(gameResult.paidRevenue),
          paidCount: Number(gameResult.paidCount),
          unpaidCount: Number(gameResult.unpaidCount),
        },
        player: {
          totalRevenue: Number(playerResult.totalRevenue),
          paidRevenue: Number(playerResult.paidRevenue),
          paidCount: Number(playerResult.paidCount),
          unpaidCount: Number(playerResult.unpaidCount),
        },
      };
    },
  }),

  getMatchdayExpensesSummary: defineAuthAction({
    roles: ["admin"],
    input: dateRangeInput,
    handler: async ({ dateFrom, dateTo }) => {
      let query = client
        .selectFrom("matchday_expense")
        .innerJoin("matchday", "matchday.id", "matchday_expense.matchday_id");

      if (dateFrom)
        query = query.where("matchday.match_date", ">=", dateFrom);
      if (dateTo)
        query = query.where("matchday.match_date", "<=", dateTo);

      const [totalResult, byType] = await Promise.all([
        query
          .select(
            sql<number>`COALESCE(SUM(matchday_expense.amount_pence), 0)`.as(
              "total",
            ),
          )
          .executeTakeFirstOrThrow(),
        query
          .select([
            "matchday_expense.expense_type",
            sql<number>`SUM(matchday_expense.amount_pence)`.as("total"),
            sql<number>`COUNT(*)`.as("count"),
          ])
          .groupBy("matchday_expense.expense_type")
          .execute(),
      ]);

      return {
        total: Number(totalResult.total),
        byType: byType.map((r) => ({
          type: r.expense_type,
          total: Number(r.total),
          count: Number(r.count),
        })),
      };
    },
  }),
};
