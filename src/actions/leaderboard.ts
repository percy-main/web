import { client } from "@/lib/db/client";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const leaderboard = {
  get: defineAction({
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
