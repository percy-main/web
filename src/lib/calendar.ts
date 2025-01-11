import type { InferEntrySchema } from "astro:content";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  formatDate,
  getDay,
  getMonth,
  startOfMonth,
} from "date-fns";

export const generateCalendar = <T extends { data: { when: Date } }>(
  date: Date,
  items: T[],
) => {
  /**
   * firstDay  | Needed extra
   * 0 Sun       6
   * 1 Mon       0
   * 2 Tue       1
   * 3 Wed       2
   * 4 Thu       3
   * 5 Fri       4
   * 6 Sat       5
   */
  const firstDateOfMonth = startOfMonth(date);
  const firstDayOfMonth = getDay(firstDateOfMonth); // 0 Sunday -> 6 Sat
  const extraDaysPre = (firstDayOfMonth + 6) % 7;

  /**
   * lastDay  | Needed extra
   * 0 Sun       0
   * 1 Mon       6
   * 2 Tue       5
   * 3 Wed       4
   * 4 Thu       3
   * 5 Fri       2
   * 6 Sat       1
   */
  const lastDateOfMonth = endOfMonth(date);
  const lastDayOfMonth = getDay(lastDateOfMonth); // 0 Sunday -> 6 Sat
  const extraDaysPost = (7 - lastDayOfMonth) % 7;

  const firstDateOfCalendar = addDays(firstDateOfMonth, -extraDaysPre);
  const lastDateOfCalendar = addDays(lastDateOfMonth, extraDaysPost);

  const totalDays = differenceInCalendarDays(
    lastDateOfCalendar,
    firstDateOfCalendar,
  );

  return Array.from(Array(totalDays + 1), (_, i) => {
    const dayDate = addDays(firstDateOfCalendar, i);
    return {
      isExtra: getMonth(dayDate) !== getMonth(date),
      date: dayDate,
      items: items.filter(
        (item) =>
          formatDate(item.data.when, "dd/MM/yyyy") ===
          formatDate(dayDate, "dd/MM/yyyy"),
      ),
    };
  });
};
