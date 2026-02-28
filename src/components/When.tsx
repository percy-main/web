import { formatInTimeZone } from "date-fns-tz";
import type { FC } from "react";
import { IoCalendar } from "react-icons/io5";

type Props = {
  start: Date;
  end?: Date;
};
export const When: FC<Props> = ({ start, end }) => (
  <div className="flex flex-row items-center justify-between gap-4 rounded-xl bg-white p-4">
    <IoCalendar fontSize={32} />
    <div className="flex flex-col gap-4">
      <p>
        <span className="font-semibold">Start: </span>
        {formatInTimeZone(start, "Europe/London", "dd/MM/yyyy HH:mm")}
      </p>
      {end && (
        <p>
          <span className="font-semibold">Finish: </span>
          {formatInTimeZone(end, "Europe/London", "dd/MM/yyyy HH:mm")}
        </p>
      )}
    </div>
  </div>
);
