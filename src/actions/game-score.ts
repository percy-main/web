import { client } from "@/lib/db/client";
import { defineAuthAction } from "@/lib/auth/api";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const gameScore = {
  submitScore: defineAuthAction({
    input: z.object({
      game: z.string(),
      score: z.number().int().min(0),
      level: z.number().int().min(1),
      catches: z.number().int().min(0),
      bestStreak: z.number().int().min(0),
    }),
    handler: async (input, session) => {
      const existing = await client
        .selectFrom("game_score")
        .select("score")
        .where("user_id", "=", session.user.id)
        .where("game", "=", input.game)
        .executeTakeFirst();

      if (existing && existing.score >= input.score) {
        return { saved: false, isNewBest: false };
      }

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      if (existing) {
        await client
          .updateTable("game_score")
          .set({
            score: input.score,
            level: input.level,
            catches: input.catches,
            best_streak: input.bestStreak,
            updated_at: now,
          })
          .where("user_id", "=", session.user.id)
          .where("game", "=", input.game)
          .execute();
      } else {
        await client
          .insertInto("game_score")
          .values({
            id,
            user_id: session.user.id,
            game: input.game,
            score: input.score,
            level: input.level,
            catches: input.catches,
            best_streak: input.bestStreak,
            updated_at: now,
          })
          .execute();
      }

      return { saved: true, isNewBest: true };
    },
  }),

  leaderboard: defineAction({
    input: z.object({
      game: z.string(),
      limit: z.number().int().min(1).max(50).optional().default(5),
    }),
    handler: async ({ game, limit }) => {
      const rows = await client
        .selectFrom("game_score")
        .innerJoin("user", "user.id", "game_score.user_id")
        .select([
          "user.name",
          "game_score.score",
          "game_score.level",
          "game_score.catches",
          "game_score.best_streak",
        ])
        .where("game_score.game", "=", game)
        .orderBy("game_score.score", "desc")
        .limit(limit)
        .execute();

      return {
        entries: rows.map((r) => ({
          name: r.name,
          score: r.score,
          level: r.level,
          catches: r.catches,
          bestStreak: r.best_streak,
        })),
      };
    },
  }),
};
