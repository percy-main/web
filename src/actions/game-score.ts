import { client } from "@/lib/db/client";
import { defineAuthAction } from "@/lib/auth/api";
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
};
