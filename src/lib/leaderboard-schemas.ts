import { z } from "zod";

// Batting schemas
export const BattingEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  contentfulEntryId: z.string().nullable(),
  innings: z.number(),
  notOuts: z.number(),
  runs: z.number(),
  highScore: z.number(),
  average: z.number().nullable(),
  strikeRate: z.number().nullable(),
  fours: z.number(),
  sixes: z.number(),
  fifties: z.number(),
  hundreds: z.number(),
});

export const BattingResponseSchema = z.object({
  entries: z.array(BattingEntrySchema),
});

export type BattingEntry = z.infer<typeof BattingEntrySchema>;
export type BattingResponse = z.infer<typeof BattingResponseSchema>;

// Bowling schemas
export const BowlingEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  contentfulEntryId: z.string().nullable(),
  matches: z.number(),
  overs: z.string(),
  maidens: z.number(),
  runs: z.number(),
  wickets: z.number(),
  average: z.number().nullable(),
  economy: z.number().nullable(),
  strikeRate: z.number().nullable(),
  bestWickets: z.number(),
});

export const BowlingResponseSchema = z.object({
  entries: z.array(BowlingEntrySchema),
});

export type BowlingEntry = z.infer<typeof BowlingEntrySchema>;
export type BowlingResponse = z.infer<typeof BowlingResponseSchema>;
