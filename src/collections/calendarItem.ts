import { defineCollection, z } from "astro:content";
import * as event from "./event";
import * as game from "./game";

const schema = z.union([
  game.schema.extend({ type: z.literal("game") }),
  event.schema.extend({ type: z.literal("event") }),
]);

export type CalendarItem = z.TypeOf<typeof schema>;

const loader = async () => {
  const [games, events] = await Promise.all([game.loader(), event.loader()]);

  return [
    ...events.map((e) => ({ ...e, type: "event" })),
    ...games.map((g) => ({ ...g, type: "game" })),
  ];
};

export const calendarItem = defineCollection({
  loader,
  schema,
});
