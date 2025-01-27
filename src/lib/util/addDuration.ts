import { type Duration, add, intervalToDuration } from "date-fns";

export const addDurations = (duration1: Duration, duration2: Duration) => {
  const baseDate = new Date(0); // can probably be any date, 0 just seemed like a good start

  return intervalToDuration({
    start: baseDate,
    end: add(add(baseDate, duration1), duration2),
  });
};
