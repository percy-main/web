import { z, defineCollection } from "astro:content";
import * as game from "./game";
import * as event from "./event";

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
